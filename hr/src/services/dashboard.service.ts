import mongoose from "mongoose"

import { PRESENT_LIKE_STATUSES } from "../constants/attendance.js"
import { DEFAULT_WORKING_DAYS } from "../constants/organization.js"
import { ActivityModel } from "../models/activity.model.js"
import { AttendanceModel } from "../models/attendance.model.js"
import { EmployeeModel } from "../models/employee.model.js"
import { HolidayModel } from "../models/holiday.model.js"
import { LeaveRequestModel } from "../models/leave-request.model.js"
import { OrganizationModel } from "../models/organization.model.js"
import { employeeScopeFilter } from "./employee.service.js"
import type { AuthContext } from "../types/auth.js"
import {
  addUtcDays,
  dateKeyFromDate,
  dateKeyInTimeZone,
  formatDayLabel,
  formatLeaveRange,
  formatShortDate,
  initialsFromName,
  leaveTypeLabel,
  monthEndKeys,
  lastWorkingDateKeys,
  relativeDayLabel,
  relativeTimeLabel,
  utcDateFromKey,
} from "../utils/dates.js"

const ACTIVE_HEADCOUNT = ["active", "on_leave"]
const DEFAULT_TIMEZONE = "Asia/Kolkata"

type CountBucket = { n?: number }
type NamedCount = { _id: unknown; name: string; count: number }
type HireDoc = {
  _id: mongoose.Types.ObjectId
  firstName: string
  lastName: string
  profileImage?: string
}
type BirthdayDoc = HireDoc & { dateOfBirth: Date }
type LeaveDoc = {
  _id: mongoose.Types.ObjectId
  type?: string
  leaveType?: { name?: string }
  startDate: Date
  endDate: Date
  employee?: {
    _id: mongoose.Types.ObjectId
    firstName: string
    lastName: string
    profileImage?: string
  }
  department?: { name?: string }
}
type ActivityDoc = {
  _id: mongoose.Types.ObjectId
  title: string
  detail?: string
  tone?: "warning" | "brand" | "success" | "default" | "muted"
  createdAt: Date
}
type HolidayDoc = {
  _id: mongoose.Types.ObjectId
  name: string
  date: Date
  region?: string
}

function asObjectId(id: string) {
  return new mongoose.Types.ObjectId(id)
}

function facetCount(buckets: CountBucket[] | undefined) {
  return buckets?.[0]?.n ?? 0
}

function fullName(person: { firstName?: string; lastName?: string }) {
  return `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim() || "Unknown"
}

function leaveName(leave: LeaveDoc) {
  return leave.leaveType?.name || leaveTypeLabel(leave.type ?? "")
}

function nextBirthdayKey(dateOfBirth: Date, todayKey: string) {
  const month = String(dateOfBirth.getUTCMonth() + 1).padStart(2, "0")
  const day = String(dateOfBirth.getUTCDate()).padStart(2, "0")
  const year = Number(todayKey.slice(0, 4))
  const thisYear = `${year}-${month}-${day}`
  return thisYear >= todayKey ? thisYear : `${year + 1}-${month}-${day}`
}

function growthPercent(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? 100 : 0
  }

  return Math.round(((current - previous) / previous) * 1000) / 10
}

function personCard(employee: HireDoc | NonNullable<LeaveDoc["employee"]>, extras: Record<string, string> = {}) {
  const name = fullName(employee)
  return {
    id: String(employee._id),
    name,
    initials: initialsFromName(name),
    profileImage: employee.profileImage ?? "",
    ...extras,
  }
}

export async function getDashboard(auth: AuthContext) {
  const organization = await OrganizationModel.findById(auth.organizationId)
    .select("timezone workingDays")
    .lean()

  const timezone = organization?.timezone || DEFAULT_TIMEZONE
  const workingDays =
    organization?.workingDays && organization.workingDays.length > 0
      ? organization.workingDays
      : [...DEFAULT_WORKING_DAYS]

  const now = new Date()
  const todayKey = dateKeyInTimeZone(now, timezone)
  const today = utcDateFromKey(todayKey)
  const tomorrow = addUtcDays(today, 1)
  const upcomingEnd = addUtcDays(today, 30)
  const workingKeys = lastWorkingDateKeys(10, todayKey, workingDays)
  const trendStart = workingKeys[0] ? utcDateFromKey(workingKeys[0]) : today
  const months = monthEndKeys(6, todayKey)
  const orgId = asObjectId(auth.organizationId)

  const scope = await employeeScopeFilter(auth)
  const isOrgWide = !scope.$or && !scope.userId
  let employeeIds: mongoose.Types.ObjectId[] | null = null

  if (!isOrgWide) {
    const scoped = await EmployeeModel.find(scope).select("_id").lean()
    employeeIds = scoped.map((row) => row._id as mongoose.Types.ObjectId)
  }

  const employeeMatch: Record<string, unknown> = { organizationId: orgId }
  if (employeeIds) {
    employeeMatch._id = { $in: employeeIds }
  }

  const relatedMatch: Record<string, unknown> = { organizationId: orgId }
  if (employeeIds) {
    relatedMatch.employeeId = { $in: employeeIds }
  }

  const growthFacet = Object.fromEntries(
    months.map((month, index) => [
      `m${index}`,
      [
        {
          $match: {
            employmentStatus: { $ne: "terminated" },
            $expr: { $lte: [{ $ifNull: ["$joiningDate", "$createdAt"] }, month.end] },
          },
        },
        { $count: "n" },
      ],
    ])
  )

  const todayMonthDay = (today.getUTCMonth() + 1) * 100 + today.getUTCDate()
  const endMonthDay = (upcomingEnd.getUTCMonth() + 1) * 100 + upcomingEnd.getUTCDate()
  const birthdayWraps = endMonthDay < todayMonthDay

  const [
    employeeFacet,
    attendanceByDay,
    approvedLeaves,
    pendingFacet,
    activities,
    holidays,
  ] = await Promise.all([
    EmployeeModel.aggregate([
      { $match: employeeMatch },
      {
        $facet: {
          totals: [
            { $match: { employmentStatus: { $in: ACTIVE_HEADCOUNT } } },
            { $count: "n" },
          ],
          expected: [{ $match: { employmentStatus: "active" } }, { $count: "n" }],
          departments: [
            { $match: { employmentStatus: { $in: ACTIVE_HEADCOUNT } } },
            { $group: { _id: "$departmentId", count: { $sum: 1 } } },
            {
              $lookup: {
                from: "departments",
                localField: "_id",
                foreignField: "_id",
                as: "dept",
              },
            },
            { $unwind: { path: "$dept", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                name: { $ifNull: ["$dept.name", "Unassigned"] },
                count: 1,
              },
            },
            { $sort: { count: -1, name: 1 } },
            { $limit: 8 },
          ],
          recentHires: [
            { $match: { employmentStatus: { $in: ACTIVE_HEADCOUNT } } },
            { $sort: { joiningDate: -1, createdAt: -1 } },
            { $limit: 5 },
            { $project: { firstName: 1, lastName: 1, profileImage: 1 } },
          ],
          birthdays: [
            { $match: { dateOfBirth: { $ne: null } } },
            {
              $addFields: {
                monthDay: {
                  $add: [
                    { $multiply: [{ $month: "$dateOfBirth" }, 100] },
                    { $dayOfMonth: "$dateOfBirth" },
                  ],
                },
              },
            },
            {
              $match: birthdayWraps
                ? {
                    $or: [
                      { monthDay: { $gte: todayMonthDay } },
                      { monthDay: { $lte: endMonthDay } },
                    ],
                  }
                : { monthDay: { $gte: todayMonthDay, $lte: endMonthDay } },
            },
            {
              $addFields: {
                sortKey: birthdayWraps
                  ? {
                      $cond: [
                        { $gte: ["$monthDay", todayMonthDay] },
                        "$monthDay",
                        { $add: ["$monthDay", 1231] },
                      ],
                    }
                  : "$monthDay",
              },
            },
            { $sort: { sortKey: 1 } },
            { $limit: 5 },
            { $project: { firstName: 1, lastName: 1, profileImage: 1, dateOfBirth: 1 } },
          ],
          ...growthFacet,
        },
      },
    ]),
    AttendanceModel.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          ...relatedMatch,
          status: { $in: [...PRESENT_LIKE_STATUSES] },
          date: { $gte: trendStart, $lt: tomorrow },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          count: { $sum: 1 },
        },
      },
    ]),
    LeaveRequestModel.aggregate<LeaveDoc>([
      {
        $match: {
          ...relatedMatch,
          status: "approved",
          startDate: { $lte: upcomingEnd },
          endDate: { $gte: trendStart },
        },
      },
      {
        $lookup: {
          from: "employees",
          localField: "employeeId",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: "$employee" },
      {
        $lookup: {
          from: "departments",
          localField: "employee.departmentId",
          foreignField: "_id",
          as: "department",
        },
      },
      { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "leavetypes",
          localField: "leaveTypeId",
          foreignField: "_id",
          as: "leaveType",
        },
      },
      { $unwind: { path: "$leaveType", preserveNullAndEmptyArrays: true } },
      { $sort: { startDate: 1 } },
    ]),
    LeaveRequestModel.aggregate([
      { $match: { ...relatedMatch, status: "pending" } },
      {
        $facet: {
          total: [{ $count: "n" }],
          items: [
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            {
              $lookup: {
                from: "employees",
                localField: "employeeId",
                foreignField: "_id",
                as: "employee",
              },
            },
            { $unwind: "$employee" },
            {
              $lookup: {
                from: "leavetypes",
                localField: "leaveTypeId",
                foreignField: "_id",
                as: "leaveType",
              },
            },
            { $unwind: { path: "$leaveType", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                type: 1,
                leaveType: { name: "$leaveType.name" },
                startDate: 1,
                endDate: 1,
                employee: {
                  _id: "$employee._id",
                  firstName: "$employee.firstName",
                  lastName: "$employee.lastName",
                  profileImage: "$employee.profileImage",
                },
              },
            },
          ],
        },
      },
    ]),
    ActivityModel.find({ organizationId: orgId })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean<ActivityDoc[]>(),
    HolidayModel.find({ organizationId: orgId, date: { $gte: today } })
      .sort({ date: 1 })
      .limit(5)
      .lean<HolidayDoc[]>(),
  ])

  const snapshot = employeeFacet[0] as
    | (Record<string, CountBucket[]> & {
        departments?: NamedCount[]
        recentHires?: HireDoc[]
        birthdays?: BirthdayDoc[]
      })
    | undefined

  const totalEmployees = facetCount(snapshot?.totals)
  const expectedToday = facetCount(snapshot?.expected)
  const presentByDate = new Map(attendanceByDay.map((row) => [row._id, row.count]))
  const presentToday = presentByDate.get(todayKey) ?? 0
  const presentPercent =
    expectedToday === 0 ? 0 : Math.min(100, Math.round((presentToday / expectedToday) * 100))

  const growthCounts = months.map((_, index) => facetCount(snapshot?.[`m${index}`]))
  const currentHeadcount = growthCounts[growthCounts.length - 1] ?? totalEmployees
  const previousHeadcount = growthCounts[growthCounts.length - 2] ?? 0

  const leaveByDay = new Map<string, Set<string>>()
  for (const key of workingKeys) {
    leaveByDay.set(key, new Set())
  }

  const onLeaveToday: LeaveDoc[] = []
  const upcomingLeaveDocs: LeaveDoc[] = []

  for (const leave of approvedLeaves) {
    if (!leave.employee) continue
    const startKey = dateKeyFromDate(leave.startDate)
    const endKey = dateKeyFromDate(leave.endDate)
    const employeeId = String(leave.employee._id)

    if (
      startKey <= todayKey &&
      endKey >= todayKey &&
      !onLeaveToday.some((row) => String(row.employee?._id) === employeeId)
    ) {
      onLeaveToday.push(leave)
    }

    if (startKey > todayKey && startKey <= dateKeyFromDate(upcomingEnd)) {
      upcomingLeaveDocs.push(leave)
    }

    for (const key of workingKeys) {
      if (startKey <= key && endKey >= key) {
        leaveByDay.get(key)?.add(employeeId)
      }
    }
  }

  const pending = pendingFacet[0] as { total?: CountBucket[]; items?: LeaveDoc[] } | undefined
  const pendingItems = pending?.items ?? []

  return {
    generatedAt: now.toISOString(),
    timezone,
    totals: {
      employees: totalEmployees,
      presentToday,
      expectedToday,
      presentPercent,
      onLeaveToday: onLeaveToday.length,
      pendingLeaveRequests: facetCount(pending?.total),
      growthPercent: growthPercent(currentHeadcount, previousHeadcount),
      growthLabel: "vs last month",
    },
    employeeGrowth: months.map((month, index) => ({
      month: month.label,
      count: growthCounts[index] ?? 0,
    })),
    attendanceTrend: workingKeys.map((key) => ({
      label: formatDayLabel(key),
      date: key,
      present: presentByDate.get(key) ?? 0,
      leave: leaveByDay.get(key)?.size ?? 0,
    })),
    departmentDistribution: (snapshot?.departments ?? []).map((department) => ({
      id: department._id ? String(department._id) : "unassigned",
      name: department.name,
      count: department.count,
    })),
    recentHires: (snapshot?.recentHires ?? []).map((hire) => personCard(hire)),
    onLeave: onLeaveToday.slice(0, 5).map((leave) => ({
      ...personCard(leave.employee!, {
        department: leave.department?.name ?? "Unassigned",
        type: leaveName(leave),
      }),
      id: String(leave._id),
    })),
    pendingRequests: pendingItems
      .filter((leave) => leave.employee)
      .map((leave) => {
        const startKey = dateKeyFromDate(leave.startDate)
        const endKey = dateKeyFromDate(leave.endDate)
        return {
          ...personCard(leave.employee!),
          id: String(leave._id),
          detail: `${leaveName(leave)} · ${formatLeaveRange(startKey, endKey)}`,
        }
      }),
    upcomingLeaves: upcomingLeaveDocs.slice(0, 4).map((leave) => {
      const startKey = dateKeyFromDate(leave.startDate)
      const endKey = dateKeyFromDate(leave.endDate)
      return {
        ...personCard(leave.employee!, {
          department: leave.department?.name ?? "Unassigned",
          type: leaveName(leave),
          range: formatLeaveRange(startKey, endKey),
          starts: relativeDayLabel(startKey, todayKey),
        }),
        id: String(leave._id),
      }
    }),
    activities: activities.map((item) => ({
      id: String(item._id),
      title: item.title,
      detail: item.detail ?? "",
      time: relativeTimeLabel(item.createdAt, now),
      tone: item.tone ?? "default",
      createdAt: item.createdAt.toISOString(),
    })),
    upcomingHolidays: holidays.map((holiday) => {
      const dateKey = dateKeyFromDate(holiday.date)
      return {
        id: String(holiday._id),
        name: holiday.name,
        date: formatShortDate(dateKey),
        when: relativeDayLabel(dateKey, todayKey),
        region: holiday.region || "Company-wide",
      }
    }),
    upcomingBirthdays: (snapshot?.birthdays ?? []).map((person) => {
      const birthdayKey = nextBirthdayKey(person.dateOfBirth, todayKey)
      const turning = Number(birthdayKey.slice(0, 4)) - person.dateOfBirth.getUTCFullYear()
      return {
        ...personCard(person),
        date: formatShortDate(birthdayKey),
        turning,
        when: relativeDayLabel(birthdayKey, todayKey),
      }
    }),
  }
}
