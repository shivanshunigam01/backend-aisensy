import mongoose, { type PipelineStage } from "mongoose"

import { PRESENT_LIKE_STATUSES } from "../constants/attendance.js"
import { ATTENDANCE_DAILY_MAX_DAYS, REPORT_MAX_RANGE_DAYS } from "../constants/reports.js"
import { APPLICATION_STAGE_LABELS } from "../constants/recruitment.js"
import { PAYROLL_CURRENCY, PAYROLL_CURRENCY_LOCALE } from "../constants/payroll.js"
import { ApplicationModel } from "../models/application.model.js"
import { AttendanceModel } from "../models/attendance.model.js"
import { EmployeeModel } from "../models/employee.model.js"
import { JobModel } from "../models/job.model.js"
import { LeaveRequestModel } from "../models/leave-request.model.js"
import { OrganizationModel } from "../models/organization.model.js"
import { PayrollModel } from "../models/payroll.model.js"
import type { AuthContext } from "../types/auth.js"
import { AppError } from "../utils/app-error.js"
import {
  addUtcDays,
  dateKeyInTimeZone,
  formatShortDate,
  utcDateFromKey,
} from "../utils/dates.js"
import { parseObjectId } from "../utils/object-id.js"
import type { ReportQueryInput } from "../validators/reports.validators.js"

const DEFAULT_TIMEZONE = "Asia/Kolkata"

type ReportMetric = { label: string; value: string; hint?: string }
type SeriesKey = { key: string; name: string }
type ChartPoint = Record<string, string | number>
type NamedValue = { name: string; value: number }
type TableColumn = { key: string; label: string; align?: "left" | "right" }
type TableRow = Record<string, string | number | null>

export type ReportPayload = {
  range: { from: string; to: string; fromLabel: string; toLabel: string }
  metrics: ReportMetric[]
  line?: { title: string; description?: string; keys: SeriesKey[]; points: ChartPoint[] }
  bar?: {
    title: string
    description?: string
    keys: SeriesKey[]
    points: ChartPoint[]
    layout?: "horizontal" | "vertical"
  }
  pie?: { title: string; description?: string; items: NamedValue[] }
  table: { title: string; columns: TableColumn[]; rows: TableRow[] }
}

type RangeContext = {
  from: string
  to: string
  fromDate: Date
  toExclusive: Date
  toDate: Date
  departmentId?: string
  departmentOid?: mongoose.Types.ObjectId
  orgId: mongoose.Types.ObjectId
  timezone: string
}

function employeeDepartmentStages(departmentOid?: mongoose.Types.ObjectId): PipelineStage[] {
  if (!departmentOid) return []
  return [
    {
      $lookup: {
        from: "employees",
        localField: "employeeId",
        foreignField: "_id",
        as: "employee",
      },
    },
    { $unwind: { path: "$employee" } },
    { $match: { "employee.departmentId": departmentOid } },
  ]
}

function asObjectId(id: string) {
  return new mongoose.Types.ObjectId(id)
}

function metric(label: string, value: string | number, hint?: string): ReportMetric {
  return { label, value: String(value), hint }
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat(PAYROLL_CURRENCY_LOCALE, {
    style: "currency",
    currency: PAYROLL_CURRENCY,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%"
  return `${Math.round(value * 10) / 10}%`
}

function monthLabel(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number)
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year ?? 2026, (month ?? 1) - 1, 1)))
}

function dayLabel(dateKey: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(utcDateFromKey(dateKey))
}

function monthKeys(fromKey: string, toKey: string) {
  const from = utcDateFromKey(fromKey)
  const to = utcDateFromKey(toKey)
  let year = from.getUTCFullYear()
  let month = from.getUTCMonth()
  const endYear = to.getUTCFullYear()
  const endMonth = to.getUTCMonth()
  const keys: string[] = []

  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${String(month + 1).padStart(2, "0")}`)
    month += 1
    if (month > 11) {
      month = 0
      year += 1
    }
  }

  return keys
}

function daysBetween(fromKey: string, toKey: string) {
  return Math.round((utcDateFromKey(toKey).getTime() - utcDateFromKey(fromKey).getTime()) / 86_400_000) + 1
}

function rangePayload(range: RangeContext) {
  return {
    from: range.from,
    to: range.to,
    fromLabel: formatShortDate(range.from),
    toLabel: formatShortDate(range.to),
  }
}

async function resolveRange(auth: AuthContext, query: ReportQueryInput): Promise<RangeContext> {
  const organization = await OrganizationModel.findById(auth.organizationId).select("timezone").lean()
  const timezone = organization?.timezone || DEFAULT_TIMEZONE
  const today = dateKeyInTimeZone(new Date(), timezone)
  const defaultFromDate = utcDateFromKey(today)
  defaultFromDate.setUTCMonth(defaultFromDate.getUTCMonth() - 6)
  const from = query.from ?? defaultFromDate.toISOString().slice(0, 10)
  const to = query.to ?? today

  if (from > to) {
    throw AppError.badRequest("Start date must be on or before the end date")
  }

  if (daysBetween(from, to) > REPORT_MAX_RANGE_DAYS) {
    throw AppError.badRequest("Choose a range of two years or less")
  }

  if (query.departmentId) {
    parseObjectId(query.departmentId)
  }

  const fromDate = utcDateFromKey(from)
  const toDate = utcDateFromKey(to)

  return {
    from,
    to,
    fromDate,
    toDate,
    toExclusive: addUtcDays(toDate, 1),
    departmentId: query.departmentId,
    departmentOid: query.departmentId ? asObjectId(query.departmentId) : undefined,
    orgId: asObjectId(auth.organizationId),
    timezone,
  }
}

function employeeMatch(range: RangeContext) {
  const match: Record<string, unknown> = { organizationId: range.orgId }
  if (range.departmentOid) match.departmentId = range.departmentOid
  return match
}

export async function employeeGrowthReport(auth: AuthContext, query: ReportQueryInput): Promise<ReportPayload> {
  const range = await resolveRange(auth, query)
  const months = monthKeys(range.from, range.to)
  const match = employeeMatch(range)

  const [facet] = await EmployeeModel.aggregate<{
    opening?: { n?: number }[]
    hires?: { _id: string; count: number }[]
    exits?: { _id: string; count: number }[]
    current?: { n?: number }[]
  }>([
    { $match: match },
    {
      $addFields: {
        joinAt: { $ifNull: ["$joiningDate", "$createdAt"] },
      },
    },
    {
      $facet: {
        opening: [
          {
            $match: {
              employmentStatus: { $ne: "terminated" },
              joinAt: { $lt: range.fromDate },
            },
          },
          { $count: "n" },
        ],
        hires: [
          { $match: { joinAt: { $gte: range.fromDate, $lt: range.toExclusive } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m", date: "$joinAt" } },
              count: { $sum: 1 },
            },
          },
        ],
        exits: [
          {
            $match: {
              employmentStatus: "terminated",
              updatedAt: { $gte: range.fromDate, $lt: range.toExclusive },
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m", date: "$updatedAt" } },
              count: { $sum: 1 },
            },
          },
        ],
        current: [
          { $match: { employmentStatus: { $in: ["active", "on_leave"] } } },
          { $count: "n" },
        ],
      },
    },
  ])

  const hireMap = new Map((facet?.hires ?? []).map((row) => [row._id, row.count]))
  const exitMap = new Map((facet?.exits ?? []).map((row) => [row._id, row.count]))
  let headcount = facet?.opening?.[0]?.n ?? 0
  const points: ChartPoint[] = []
  const rows: TableRow[] = []
  let hires = 0
  let exits = 0

  for (const key of months) {
    const monthHires = hireMap.get(key) ?? 0
    const monthExits = exitMap.get(key) ?? 0
    headcount = Math.max(0, headcount + monthHires - monthExits)
    hires += monthHires
    exits += monthExits
    const label = monthLabel(key)
    points.push({ label, Headcount: headcount, Hires: monthHires, Exits: monthExits })
    rows.push({ period: label, hires: monthHires, exits: monthExits, headcount })
  }

  const current = facet?.current?.[0]?.n ?? 0
  const net = hires - exits

  return {
    range: rangePayload(range),
    metrics: [
      metric("Headcount", current, "Active and on leave"),
      metric("Hires", hires, "Joined in this range"),
      metric("Exits", exits, "Marked terminated in this range"),
      metric("Net change", net >= 0 ? `+${net}` : String(net)),
    ],
    line: {
      title: "Headcount",
      description: "Month-end headcount with hires and exits.",
      keys: [
        { key: "Headcount", name: "Headcount" },
        { key: "Hires", name: "Hires" },
        { key: "Exits", name: "Exits" },
      ],
      points,
    },
    table: {
      title: "Monthly movement",
      columns: [
        { key: "period", label: "Month" },
        { key: "hires", label: "Hires", align: "right" },
        { key: "exits", label: "Exits", align: "right" },
        { key: "headcount", label: "Headcount", align: "right" },
      ],
      rows,
    },
  }
}

export async function attendanceReport(auth: AuthContext, query: ReportQueryInput): Promise<ReportPayload> {
  const range = await resolveRange(auth, query)
  const daily = daysBetween(range.from, range.to) <= ATTENDANCE_DAILY_MAX_DAYS
  const grain = daily ? "%Y-%m-%d" : "%Y-%m"

  const [statusRows, departmentRows] = await Promise.all([
    AttendanceModel.aggregate<{ _id: { bucket: string; status: string }; count: number; minutes: number }>([
      {
        $match: {
          organizationId: range.orgId,
          date: { $gte: range.fromDate, $lt: range.toExclusive },
        },
      },
      ...employeeDepartmentStages(range.departmentOid),
      {
        $group: {
          _id: {
            bucket: { $dateToString: { format: grain, date: "$date" } },
            status: "$status",
          },
          count: { $sum: 1 },
          minutes: { $sum: "$workingMinutes" },
        },
      },
    ]),
    AttendanceModel.aggregate<{
      _id: string
      present: number
      leave: number
      absent: number
      late: number
      hours: number
    }>([
      {
        $match: {
          organizationId: range.orgId,
          date: { $gte: range.fromDate, $lt: range.toExclusive },
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
      ...(range.departmentOid ? [{ $match: { "employee.departmentId": range.departmentOid } }] : []),
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
        $group: {
          _id: { $ifNull: ["$department.name", "Unassigned"] },
          present: {
            $sum: { $cond: [{ $in: ["$status", [...PRESENT_LIKE_STATUSES]] }, 1, 0] },
          },
          leave: { $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } },
          hours: { $sum: "$workingMinutes" },
        },
      },
      { $sort: { present: -1, _id: 1 } },
      { $limit: 50 },
    ]),
  ])

  const bucketMap = new Map<string, { present: number; leave: number; absent: number }>()
  const statusTotals = new Map<string, number>()
  let present = 0
  let leave = 0
  let absent = 0
  let late = 0

  for (const row of statusRows) {
    const bucket = row._id.bucket
    const current = bucketMap.get(bucket) ?? { present: 0, leave: 0, absent: 0 }
    const isPresent = (PRESENT_LIKE_STATUSES as readonly string[]).includes(row._id.status)
    if (isPresent) {
      current.present += row.count
      present += row.count
    } else if (row._id.status === "leave") {
      current.leave += row.count
      leave += row.count
    } else if (row._id.status === "absent") {
      current.absent += row.count
      absent += row.count
    }
    if (row._id.status === "late") late += row.count
    statusTotals.set(row._id.status, (statusTotals.get(row._id.status) ?? 0) + row.count)
    bucketMap.set(bucket, current)
  }

  const seriesKeys = daily ? [...bucketMap.keys()].sort() : monthKeys(range.from, range.to)
  const points: ChartPoint[] = seriesKeys.map((key) => {
    const values = bucketMap.get(key) ?? { present: 0, leave: 0, absent: 0 }
    return {
      label: daily ? dayLabel(key) : monthLabel(key),
      Present: values.present,
      Leave: values.leave,
      Absent: values.absent,
    }
  })

  const recorded = present + leave + absent
  const pieItems = [...statusTotals.entries()]
    .map(([name, value]) => ({ name: name.replaceAll("_", " "), value }))
    .sort((a, b) => b.value - a.value)

  return {
    range: rangePayload(range),
    metrics: [
      metric("Present days", present, "Includes late, half-day, and WFH"),
      metric("On leave", leave),
      metric("Absent", absent),
      metric("Late", late, recorded ? `${formatPercent((late / Math.max(present, 1)) * 100)} of present-like` : undefined),
    ],
    line: {
      title: daily ? "Daily attendance" : "Monthly attendance",
      description: "Present, leave, and absent records in the selected range.",
      keys: [
        { key: "Present", name: "Present" },
        { key: "Leave", name: "Leave" },
        { key: "Absent", name: "Absent" },
      ],
      points,
    },
    pie: {
      title: "Status mix",
      description: "Share of attendance statuses.",
      items: pieItems,
    },
    table: {
      title: "By department",
      columns: [
        { key: "department", label: "Department" },
        { key: "present", label: "Present", align: "right" },
        { key: "late", label: "Late", align: "right" },
        { key: "leave", label: "Leave", align: "right" },
        { key: "absent", label: "Absent", align: "right" },
        { key: "hours", label: "Hours", align: "right" },
      ],
      rows: departmentRows.map((row) => ({
        department: row._id,
        present: row.present,
        late: row.late,
        leave: row.leave,
        absent: row.absent,
        hours: Math.round((row.hours / 60) * 10) / 10,
      })),
    },
  }
}

export async function leaveReport(auth: AuthContext, query: ReportQueryInput): Promise<ReportPayload> {
  const range = await resolveRange(auth, query)

  const overlapMatch = {
    organizationId: range.orgId,
    startDate: { $lte: range.toDate },
    endDate: { $gte: range.fromDate },
  }

  const [typeRows, statusRows, departmentRows] = await Promise.all([
    LeaveRequestModel.aggregate<{ _id: string; days: number; count: number }>([
      { $match: { ...overlapMatch, status: "approved" } },
      ...employeeDepartmentStages(range.departmentOid),
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
        $group: {
          _id: { $ifNull: ["$leaveType.name", "Unknown"] },
          days: { $sum: "$totalDays" },
          count: { $sum: 1 },
        },
      },
      { $sort: { days: -1, _id: 1 } },
    ]),
    LeaveRequestModel.aggregate<{ _id: string; count: number }>([
      { $match: overlapMatch },
      ...employeeDepartmentStages(range.departmentOid),
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    LeaveRequestModel.aggregate<{ _id: string; days: number; pending: number; approved: number }>([
      { $match: overlapMatch },
      {
        $lookup: {
          from: "employees",
          localField: "employeeId",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: "$employee" },
      ...(range.departmentOid ? [{ $match: { "employee.departmentId": range.departmentOid } }] : []),
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
        $group: {
          _id: { $ifNull: ["$department.name", "Unassigned"] },
          days: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, "$totalDays", 0] } },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
        },
      },
      { $sort: { days: -1, _id: 1 } },
      { $limit: 50 },
    ]),
  ])

  const statusMap = new Map(statusRows.map((row) => [row._id, row.count]))
  const approvedDays = typeRows.reduce((sum, row) => sum + row.days, 0)

  return {
    range: rangePayload(range),
    metrics: [
      metric("Approved days", Math.round(approvedDays * 10) / 10),
      metric("Approved requests", statusMap.get("approved") ?? 0),
      metric("Pending", statusMap.get("pending") ?? 0),
      metric("Rejected", statusMap.get("rejected") ?? 0),
    ],
    bar: {
      title: "Days by leave type",
      description: "Approved leave days in the selected range.",
      layout: "horizontal",
      keys: [{ key: "Days", name: "Days" }],
      points: typeRows.map((row) => ({ label: row._id, Days: Math.round(row.days * 10) / 10 })),
    },
    pie: {
      title: "Request status",
      items: statusRows.map((row) => ({ name: row._id, value: row.count })),
    },
    table: {
      title: "By department",
      columns: [
        { key: "department", label: "Department" },
        { key: "days", label: "Approved days", align: "right" },
        { key: "approved", label: "Approved", align: "right" },
        { key: "pending", label: "Pending", align: "right" },
      ],
      rows: departmentRows.map((row) => ({
        department: row._id,
        days: Math.round(row.days * 10) / 10,
        approved: row.approved,
        pending: row.pending,
      })),
    },
  }
}

export async function departmentReport(auth: AuthContext, query: ReportQueryInput): Promise<ReportPayload> {
  const range = await resolveRange(auth, query)
  const match = {
    ...employeeMatch(range),
    employmentStatus: { $in: ["active", "on_leave"] },
  }

  const [deptRows, typeRows] = await Promise.all([
    EmployeeModel.aggregate<{
      _id: string
      people: number
      onLeave: number
      remote: number
      tenureMs: number
    }>([
      { $match: match },
      {
        $lookup: {
          from: "departments",
          localField: "departmentId",
          foreignField: "_id",
          as: "department",
        },
      },
      { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$department.name", "Unassigned"] },
          people: { $sum: 1 },
          onLeave: { $sum: { $cond: [{ $eq: ["$employmentStatus", "on_leave"] }, 1, 0] } },
          remote: {
            $sum: { $cond: [{ $in: ["$workLocation", ["remote", "hybrid"]] }, 1, 0] },
          },
          tenureMs: {
            $avg: {
              $subtract: [new Date(), { $ifNull: ["$joiningDate", "$createdAt"] }],
            },
          },
        },
      },
      { $sort: { people: -1, _id: 1 } },
      { $limit: 50 },
    ]),
    EmployeeModel.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: "$employmentType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ])

  const people = deptRows.reduce((sum, row) => sum + row.people, 0)
  const onLeave = deptRows.reduce((sum, row) => sum + row.onLeave, 0)
  const msYear = 365.25 * 24 * 60 * 60 * 1000
  const typeLabels: Record<string, string> = {
    full_time: "Full time",
    part_time: "Part time",
    contract: "Contract",
    intern: "Intern",
  }

  return {
    range: rangePayload(range),
    metrics: [
      metric("People", people, "Active and on leave"),
      metric("Departments", deptRows.filter((row) => row._id !== "Unassigned").length),
      metric("On leave", onLeave),
      metric("Remote / hybrid", deptRows.reduce((sum, row) => sum + row.remote, 0)),
    ],
    bar: {
      title: "Headcount by department",
      description: "Current people, not limited to the date range.",
      layout: "horizontal",
      keys: [{ key: "People", name: "People" }],
      points: deptRows.map((row) => ({ label: row._id, People: row.people })),
    },
    pie: {
      title: "Employment type",
      items: typeRows.map((row) => ({
        name: typeLabels[row._id] ?? row._id.replaceAll("_", " "),
        value: row.count,
      })),
    },
    table: {
      title: "Department snapshot",
      columns: [
        { key: "department", label: "Department" },
        { key: "people", label: "People", align: "right" },
        { key: "onLeave", label: "On leave", align: "right" },
        { key: "remote", label: "Remote / hybrid", align: "right" },
        { key: "tenure", label: "Avg tenure (yrs)", align: "right" },
      ],
      rows: deptRows.map((row) => ({
        department: row._id,
        people: row.people,
        onLeave: row.onLeave,
        remote: row.remote,
        tenure: Math.round((row.tenureMs / msYear) * 10) / 10,
      })),
    },
  }
}

export async function recruitmentReport(auth: AuthContext, query: ReportQueryInput): Promise<ReportPayload> {
  const range = await resolveRange(auth, query)
  const jobMatch: Record<string, unknown> = { organizationId: range.orgId }
  if (range.departmentOid) jobMatch.departmentId = range.departmentOid

  const applicationBase: PipelineStage[] = [
    {
      $match: {
        organizationId: range.orgId,
        appliedDate: { $gte: range.fromDate, $lt: range.toExclusive },
      },
    },
    {
      $lookup: {
        from: "jobs",
        localField: "jobId",
        foreignField: "_id",
        as: "job",
      },
    },
    { $unwind: { path: "$job" } },
    ...(range.departmentOid ? [{ $match: { "job.departmentId": range.departmentOid } } satisfies PipelineStage] : []),
  ]

  const [stageRows, monthlyRows, jobRows, openJobs] = await Promise.all([
    ApplicationModel.aggregate<{ _id: string; count: number }>([
      ...applicationBase,
      { $group: { _id: "$stage", count: { $sum: 1 } } },
    ]),
    ApplicationModel.aggregate<{ _id: string; count: number }>([
      ...applicationBase,
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$appliedDate" } },
          count: { $sum: 1 },
        },
      },
    ]),
    ApplicationModel.aggregate<{ _id: string; applications: number; hired: number; rejected: number }>([
      ...applicationBase,
      {
        $group: {
          _id: { $ifNull: ["$job.title", "Untitled"] },
          applications: { $sum: 1 },
          hired: { $sum: { $cond: [{ $eq: ["$stage", "hired"] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ["$stage", "rejected"] }, 1, 0] } },
        },
      },
      { $sort: { applications: -1, _id: 1 } },
      { $limit: 50 },
    ]),
    JobModel.countDocuments({ ...jobMatch, status: "open" }),
  ])

  const stageMap = new Map(stageRows.map((row) => [row._id, row.count]))
  const applications = stageRows.reduce((sum, row) => sum + row.count, 0)
  const hired = stageMap.get("hired") ?? 0
  const monthlyMap = new Map(monthlyRows.map((row) => [row._id, row.count]))
  const stages = Object.keys(APPLICATION_STAGE_LABELS) as Array<keyof typeof APPLICATION_STAGE_LABELS>

  return {
    range: rangePayload(range),
    metrics: [
      metric("Open jobs", openJobs),
      metric("Applications", applications),
      metric("Hired", hired),
      metric("Hire rate", applications ? formatPercent((hired / applications) * 100) : "—"),
    ],
    bar: {
      title: "Pipeline",
      description: "Applications in this range by stage.",
      keys: [{ key: "Applications", name: "Applications" }],
      points: stages.map((stage) => ({
        label: APPLICATION_STAGE_LABELS[stage],
        Applications: stageMap.get(stage) ?? 0,
      })),
    },
    line: {
      title: "Applications over time",
      keys: [{ key: "Applications", name: "Applications" }],
      points: monthKeys(range.from, range.to).map((key) => ({
        label: monthLabel(key),
        Applications: monthlyMap.get(key) ?? 0,
      })),
    },
    table: {
      title: "By job",
      columns: [
        { key: "job", label: "Job" },
        { key: "applications", label: "Applications", align: "right" },
        { key: "hired", label: "Hired", align: "right" },
        { key: "rejected", label: "Rejected", align: "right" },
      ],
      rows: jobRows.map((row) => ({
        job: row._id,
        applications: row.applications,
        hired: row.hired,
        rejected: row.rejected,
      })),
    },
  }
}

export async function payrollReport(auth: AuthContext, query: ReportQueryInput): Promise<ReportPayload> {
  const range = await resolveRange(auth, query)
  const fromValue = range.fromDate.getUTCFullYear() * 12 + (range.fromDate.getUTCMonth() + 1)
  const toValue = range.toDate.getUTCFullYear() * 12 + (range.toDate.getUTCMonth() + 1)

  const periodMatch = {
    $expr: {
      $and: [
        { $gte: [{ $add: [{ $multiply: ["$year", 12] }, "$month"] }, fromValue] },
        { $lte: [{ $add: [{ $multiply: ["$year", 12] }, "$month"] }, toValue] },
      ],
    },
  }

  const [monthlyRows, departmentRows] = await Promise.all([
    PayrollModel.aggregate<{
      _id: { year: number; month: number }
      people: number
      gross: number
      net: number
      deductions: number
      paid: number
    }>([
      { $match: { organizationId: range.orgId, ...periodMatch } },
      ...employeeDepartmentStages(range.departmentOid),
      {
        $group: {
          _id: { year: "$year", month: "$month" },
          people: { $sum: 1 },
          gross: { $sum: "$grossSalary" },
          net: { $sum: "$netSalary" },
          deductions: { $sum: "$totalDeductions" },
          paid: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
    PayrollModel.aggregate<{ _id: string; net: number; people: number }>([
      { $match: { organizationId: range.orgId, ...periodMatch } },
      {
        $lookup: {
          from: "employees",
          localField: "employeeId",
          foreignField: "_id",
          as: "employee",
        },
      },
      { $unwind: "$employee" },
      ...(range.departmentOid ? [{ $match: { "employee.departmentId": range.departmentOid } }] : []),
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
        $group: {
          _id: { $ifNull: ["$department.name", "Unassigned"] },
          net: { $sum: "$netSalary" },
          people: { $sum: 1 },
        },
      },
      { $sort: { net: -1, _id: 1 } },
      { $limit: 12 },
    ]),
  ])

  const net = monthlyRows.reduce((sum, row) => sum + row.net, 0)
  const gross = monthlyRows.reduce((sum, row) => sum + row.gross, 0)
  const people = monthlyRows.reduce((sum, row) => Math.max(sum, row.people), 0)
  const paid = monthlyRows.reduce((sum, row) => sum + row.paid, 0)
  const generated = monthlyRows.reduce((sum, row) => sum + row.people, 0)

  return {
    range: rangePayload(range),
    metrics: [
      metric("Net pay", formatMoney(net)),
      metric("Gross", formatMoney(gross)),
      metric("Payslips", generated),
      metric("Paid", paid, people ? `${formatPercent((paid / Math.max(generated, 1)) * 100)} of runs` : undefined),
    ],
    line: {
      title: "Payroll over time",
      description: "Gross and net by month.",
      keys: [
        { key: "Net", name: "Net" },
        { key: "Gross", name: "Gross" },
      ],
      points: monthlyRows.map((row) => {
        const key = `${row._id.year}-${String(row._id.month).padStart(2, "0")}`
        return {
          label: monthLabel(key),
          Net: Math.round(row.net),
          Gross: Math.round(row.gross),
        }
      }),
    },
    pie: {
      title: "Net by department",
      items: departmentRows.map((row) => ({ name: row._id, value: Math.round(row.net) })),
    },
    table: {
      title: "Monthly payroll",
      columns: [
        { key: "period", label: "Month" },
        { key: "people", label: "People", align: "right" },
        { key: "gross", label: "Gross", align: "right" },
        { key: "deductions", label: "Deductions", align: "right" },
        { key: "net", label: "Net", align: "right" },
        { key: "paid", label: "Paid", align: "right" },
      ],
      rows: monthlyRows.map((row) => {
        const key = `${row._id.year}-${String(row._id.month).padStart(2, "0")}`
        return {
          period: monthLabel(key),
          people: row.people,
          gross: formatMoney(row.gross),
          deductions: formatMoney(row.deductions),
          net: formatMoney(row.net),
          paid: row.paid,
        }
      }),
    },
  }
}
