import mongoose from "mongoose"

import {
  HALF_DAY_RATIO,
  LATE_GRACE_MINUTES,
  PRESENT_LIKE_STATUSES,
  type AttendanceSessionStatus,
  type AttendanceStatus,
} from "../constants/attendance.js"
import { MESSAGES } from "../constants/messages.js"
import { DEFAULT_WORKING_DAYS, DEFAULT_WORKING_HOURS } from "../constants/organization.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { AttendanceModel } from "../models/attendance.model.js"
import { EmployeeModel } from "../models/employee.model.js"
import { HolidayModel } from "../models/holiday.model.js"
import { LeaveRequestModel } from "../models/leave-request.model.js"
import { OrganizationModel } from "../models/organization.model.js"
import type { AuthContext } from "../types/auth.js"
import { hasAnyPermission } from "../utils/access.js"
import { recordActivity } from "../utils/activity.js"
import { notifyAttendanceLate } from "../notifications/index.js"
import { AppError } from "../utils/app-error.js"
import {
  dateKeyFromDate,
  dateKeyInTimeZone,
  expectedWorkingMinutes,
  formatTimeInTimeZone,
  initialsFromName,
  isWorkingDateKey,
  monthDateKeys,
  utcDateFromKey,
  zonedDateTime,
} from "../utils/dates.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { escapeRegex, mongoSort, resolvedSearch } from "../utils/search.js"
import type {
  AttendanceCalendarQueryInput,
  AttendanceDailyQueryInput,
  AttendanceListQueryInput,
  AttendanceMonthlyQueryInput,
  CheckInInput,
  UpdateAttendanceInput,
} from "../validators/attendance.validators.js"

const DEFAULT_TIMEZONE = "Asia/Kolkata"
const PRESENT_SET = new Set<string>(PRESENT_LIKE_STATUSES)

type OrgContext = {
  timezone: string
  workingDays: string[]
  workingHours: { start: string; end: string }
  weekStartsOn: string
  todayKey: string
  today: Date
  now: Date
  expectedMinutes: number
}

type AttendanceLean = {
  _id: mongoose.Types.ObjectId
  organizationId: mongoose.Types.ObjectId
  employeeId: mongoose.Types.ObjectId | PopulatedEmployee
  date: Date
  checkIn: Date | null
  checkOut: Date | null
  breakStartedAt: Date | null
  breakMinutes: number
  workingMinutes: number
  overtimeMinutes: number
  status: AttendanceStatus
  notes?: string
  source?: string
  createdAt: Date
  updatedAt: Date
}

type PopulatedEmployee = {
  _id: mongoose.Types.ObjectId
  firstName: string
  lastName: string
  profileImage?: string
  employeeCode?: string
  workLocation?: string
  managerId?: mongoose.Types.ObjectId | null
  departmentId?: { _id: mongoose.Types.ObjectId; name: string } | mongoose.Types.ObjectId | null
}

function asId(value: unknown) {
  if (!value) return ""
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id: unknown })._id)
  }
  return String(value)
}

function employeeName(employee: PopulatedEmployee) {
  return `${employee.firstName} ${employee.lastName}`.trim()
}

function toEmployeeCard(employee: PopulatedEmployee) {
  const name = employeeName(employee)
  const department =
    employee.departmentId && typeof employee.departmentId === "object" && "name" in employee.departmentId
      ? employee.departmentId.name
      : null

  return {
    id: String(employee._id),
    name,
    initials: initialsFromName(name),
    profileImage: employee.profileImage ?? "",
    employeeCode: employee.employeeCode ?? "",
    department,
    workLocation: employee.workLocation ?? "office",
  }
}

async function loadOrgContext(organizationId: string, now = new Date()): Promise<OrgContext> {
  const organization = await OrganizationModel.findById(organizationId)
    .select("timezone workingDays workingHours settings")
    .lean()

  const timezone = organization?.timezone || DEFAULT_TIMEZONE
  const workingDays =
    organization?.workingDays && organization.workingDays.length > 0
      ? organization.workingDays
      : [...DEFAULT_WORKING_DAYS]
  const workingHours = {
    start: organization?.workingHours?.start || DEFAULT_WORKING_HOURS.start,
    end: organization?.workingHours?.end || DEFAULT_WORKING_HOURS.end,
  }
  const todayKey = dateKeyInTimeZone(now, timezone)

  return {
    timezone,
    workingDays,
    workingHours,
    weekStartsOn: organization?.settings?.weekStartsOn || "monday",
    todayKey,
    today: utcDateFromKey(todayKey),
    now,
    expectedMinutes: expectedWorkingMinutes(workingHours.start, workingHours.end),
  }
}

async function attendanceEmployeeFilter(auth: AuthContext) {
  if (hasAnyPermission(auth.role, [PERMISSIONS.ATTENDANCE_READ, PERMISSIONS.ATTENDANCE_MANAGE])) {
    return { organizationId: auth.organizationId } as Record<string, unknown>
  }

  if (hasAnyPermission(auth.role, [PERMISSIONS.ATTENDANCE_READ_TEAM])) {
    const mine = await EmployeeModel.findOne({
      organizationId: auth.organizationId,
      userId: auth.userId,
    })
      .select("_id")
      .lean()

    return {
      organizationId: auth.organizationId,
      $or: mine
        ? [{ userId: auth.userId }, { managerId: mine._id }]
        : [{ userId: auth.userId }],
    } as Record<string, unknown>
  }

  if (hasAnyPermission(auth.role, [PERMISSIONS.ATTENDANCE_READ_SELF, PERMISSIONS.ATTENDANCE_CHECK_IN])) {
    return { organizationId: auth.organizationId, userId: auth.userId } as Record<string, unknown>
  }

  throw AppError.forbidden()
}

async function scopedEmployeeIds(auth: AuthContext) {
  const filter = await attendanceEmployeeFilter(auth)
  const isOrgWide = !filter.$or && !filter.userId
  if (isOrgWide) {
    return null
  }

  const rows = await EmployeeModel.find(filter).select("_id").lean()
  return rows.map((row) => row._id as mongoose.Types.ObjectId)
}

async function requireMyEmployee(auth: AuthContext) {
  const employee = await EmployeeModel.findOne({
    organizationId: auth.organizationId,
    userId: auth.userId,
  })
    .populate({ path: "departmentId", select: "name" })
    .lean<PopulatedEmployee & { userId: mongoose.Types.ObjectId; workLocation?: string }>()

  if (!employee) {
    throw AppError.notFound(MESSAGES.NO_EMPLOYEE_PROFILE)
  }

  return employee
}

async function assertEmployeeInScope(auth: AuthContext, employeeId: string) {
  parseObjectId(employeeId)
  const filter = await attendanceEmployeeFilter(auth)
  const employee = await EmployeeModel.findOne({ ...filter, _id: employeeId })
    .populate({ path: "departmentId", select: "name" })
    .lean<PopulatedEmployee>()

  if (!employee) {
    throw AppError.forbidden()
  }

  return employee
}

function liveMinutes(
  record: {
    checkIn?: Date | null
    checkOut?: Date | null
    breakStartedAt?: Date | null
    breakMinutes?: number
  },
  now: Date,
  expectedMinutes: number
) {
  const completedBreak = Math.max(0, record.breakMinutes ?? 0)
  const openBreak =
    record.breakStartedAt && !record.checkOut
      ? Math.max(0, Math.round((now.getTime() - record.breakStartedAt.getTime()) / 60_000))
      : 0
  const breakMinutes = completedBreak + openBreak

  if (!record.checkIn) {
    return { workingMinutes: 0, breakMinutes, overtimeMinutes: 0 }
  }

  const end = record.checkOut ?? now
  const gross = Math.max(0, Math.round((end.getTime() - record.checkIn.getTime()) / 60_000))
  const workingMinutes = Math.max(0, gross - breakMinutes)
  const overtimeMinutes = Math.max(0, workingMinutes - expectedMinutes)

  return { workingMinutes, breakMinutes, overtimeMinutes }
}

function deriveStatus(input: {
  current: AttendanceStatus
  checkedOut: boolean
  workingMinutes: number
  expectedMinutes: number
  wfh: boolean
  late: boolean
}): AttendanceStatus {
  if (input.current === "leave" || input.current === "holiday") {
    return input.current
  }

  if (
    input.checkedOut &&
    input.expectedMinutes > 0 &&
    input.workingMinutes < input.expectedMinutes * HALF_DAY_RATIO
  ) {
    return "half_day"
  }

  if (input.wfh || input.current === "wfh") {
    return "wfh"
  }

  if (input.late || input.current === "late") {
    return "late"
  }

  return "present"
}

function sessionStatus(input: {
  onLeave: boolean
  holiday: boolean
  checkIn: Date | null
  checkOut: Date | null
  breakStartedAt: Date | null
}): AttendanceSessionStatus {
  if (!input.checkIn && input.onLeave) return "on_leave"
  if (!input.checkIn && input.holiday) return "holiday"
  if (!input.checkIn) return "not_started"
  if (input.checkOut) return "checked_out"
  if (input.breakStartedAt) return "on_break"
  return "working"
}

function toPublicAttendance(
  doc: AttendanceLean,
  now: Date,
  expectedMinutes: number,
  timezone: string
) {
  const live = liveMinutes(doc, now, expectedMinutes)
  const employee =
    doc.employeeId && typeof doc.employeeId === "object" && "firstName" in doc.employeeId
      ? toEmployeeCard(doc.employeeId)
      : null

  return {
    id: String(doc._id),
    organizationId: asId(doc.organizationId),
    employeeId: employee?.id ?? asId(doc.employeeId),
    employee,
    date: dateKeyFromDate(doc.date),
    checkIn: doc.checkIn ? doc.checkIn.toISOString() : null,
    checkOut: doc.checkOut ? doc.checkOut.toISOString() : null,
    checkInLabel: doc.checkIn ? formatTimeInTimeZone(doc.checkIn, timezone) : null,
    checkOutLabel: doc.checkOut ? formatTimeInTimeZone(doc.checkOut, timezone) : null,
    breakStartedAt: doc.breakStartedAt ? doc.breakStartedAt.toISOString() : null,
    breakMinutes: live.breakMinutes,
    workingMinutes: live.workingMinutes,
    overtimeMinutes: live.overtimeMinutes,
    status: doc.status,
    notes: doc.notes ?? "",
    source: doc.source ?? "self",
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }
}

const EMPLOYEE_POPULATE = {
  path: "employeeId",
  select: "firstName lastName profileImage employeeCode departmentId workLocation",
  populate: { path: "departmentId", select: "name" },
}

async function loadRecord(organizationId: string, employeeId: string, date: Date) {
  return AttendanceModel.findOne({ organizationId, employeeId, date })
}

async function todayFlags(organizationId: string, employeeId: string, today: Date, nextDay: Date) {
  const [holiday, leave] = await Promise.all([
    HolidayModel.findOne({ organizationId, date: today }).select("name").lean(),
    LeaveRequestModel.findOne({
      organizationId,
      employeeId,
      status: "approved",
      startDate: { $lte: today },
      endDate: { $gte: today },
    })
      .select("_id")
      .lean(),
  ])

  return {
    holiday: holiday ? { id: String(holiday._id), name: holiday.name } : null,
    onLeave: Boolean(leave),
    nextDay,
  }
}

export async function getToday(auth: AuthContext) {
  const org = await loadOrgContext(auth.organizationId)
  const employee = await EmployeeModel.findOne({
    organizationId: auth.organizationId,
    userId: auth.userId,
  })
    .populate({ path: "departmentId", select: "name" })
    .lean<PopulatedEmployee & { workLocation?: string }>()

  const expectedCheckoutAt = zonedDateTime(org.todayKey, org.workingHours.end, org.timezone)

  if (!employee) {
    return {
      generatedAt: org.now.toISOString(),
      timezone: org.timezone,
      today: org.todayKey,
      now: org.now.toISOString(),
      workingDays: org.workingDays,
      workingHours: org.workingHours,
      weekStartsOn: org.weekStartsOn,
      expectedMinutes: org.expectedMinutes,
      expectedCheckoutAt: expectedCheckoutAt.toISOString(),
      expectedCheckoutLabel: formatTimeInTimeZone(expectedCheckoutAt, org.timezone),
      holiday: null,
      onLeave: false,
      sessionStatus: "not_started" as const,
      employee: null,
      attendance: null,
    }
  }

  const flags = await todayFlags(
    auth.organizationId,
    String(employee._id),
    org.today,
    new Date(org.today.getTime() + 86_400_000)
  )
  const record = await loadRecord(auth.organizationId, String(employee._id), org.today)
  const attendance = record
    ? toPublicAttendance(record.toObject() as AttendanceLean, org.now, org.expectedMinutes, org.timezone)
    : null

  return {
    generatedAt: org.now.toISOString(),
    timezone: org.timezone,
    today: org.todayKey,
    now: org.now.toISOString(),
    workingDays: org.workingDays,
    workingHours: org.workingHours,
    weekStartsOn: org.weekStartsOn,
    expectedMinutes: org.expectedMinutes,
    expectedCheckoutAt: expectedCheckoutAt.toISOString(),
    expectedCheckoutLabel: formatTimeInTimeZone(expectedCheckoutAt, org.timezone),
    holiday: flags.holiday,
    onLeave: flags.onLeave,
    sessionStatus: sessionStatus({
      onLeave: flags.onLeave,
      holiday: Boolean(flags.holiday),
      checkIn: record?.checkIn ?? null,
      checkOut: record?.checkOut ?? null,
      breakStartedAt: record?.breakStartedAt ?? null,
    }),
    employee: toEmployeeCard(employee),
    attendance,
  }
}

export async function checkIn(auth: AuthContext, input: CheckInInput) {
  const org = await loadOrgContext(auth.organizationId)
  const employee = await requireMyEmployee(auth)
  const flags = await todayFlags(
    auth.organizationId,
    String(employee._id),
    org.today,
    new Date(org.today.getTime() + 86_400_000)
  )

  if (flags.onLeave) {
    throw AppError.badRequest(MESSAGES.ON_LEAVE_TODAY)
  }

  const existing = await loadRecord(auth.organizationId, String(employee._id), org.today)
  if (existing?.checkIn) {
    throw AppError.conflict(MESSAGES.ALREADY_CHECKED_IN)
  }

  const startAt = zonedDateTime(org.todayKey, org.workingHours.start, org.timezone)
  const late = org.now.getTime() > startAt.getTime() + LATE_GRACE_MINUTES * 60_000
  const wfh = input.wfh ?? employee.workLocation === "remote"
  const status = deriveStatus({
    current: "present",
    checkedOut: false,
    workingMinutes: 0,
    expectedMinutes: org.expectedMinutes,
    wfh,
    late,
  })

  const payload = {
    checkIn: org.now,
    checkOut: null,
    breakStartedAt: null,
    breakMinutes: 0,
    workingMinutes: 0,
    overtimeMinutes: 0,
    status,
    notes: input.notes ?? existing?.notes ?? "",
    source: "self" as const,
  }

  const record = existing
    ? await AttendanceModel.findByIdAndUpdate(existing._id, payload, { new: true })
    : await AttendanceModel.create({
        organizationId: auth.organizationId,
        employeeId: employee._id,
        date: org.today,
        ...payload,
      })

  await recordActivity(auth.organizationId, {
    title: `${employeeName(employee)} checked in`,
    detail: `${formatTimeInTimeZone(org.now, org.timezone)} · ${status === "wfh" ? "Working from home" : status === "late" ? "Arrived late" : "On site"}`,
    tone: status === "late" ? "warning" : "success",
  })

  if (status === "late") {
    await notifyAttendanceLate({
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      employeeName: employeeName(employee),
      managerId: employee.managerId,
      timeLabel: formatTimeInTimeZone(org.now, org.timezone),
    })
  }

  return getToday(auth)
}

export async function checkOut(auth: AuthContext) {
  const org = await loadOrgContext(auth.organizationId)
  const employee = await requireMyEmployee(auth)
  const record = await loadRecord(auth.organizationId, String(employee._id), org.today)

  if (!record?.checkIn) {
    throw AppError.badRequest(MESSAGES.NOT_CHECKED_IN)
  }

  if (record.checkOut) {
    throw AppError.conflict(MESSAGES.ALREADY_CHECKED_OUT)
  }

  if (record.breakStartedAt) {
    const extra = Math.max(0, Math.round((org.now.getTime() - record.breakStartedAt.getTime()) / 60_000))
    record.breakMinutes += extra
    record.breakStartedAt = null
  }

  record.checkOut = org.now
  const live = liveMinutes(record, org.now, org.expectedMinutes)
  record.workingMinutes = live.workingMinutes
  record.overtimeMinutes = live.overtimeMinutes
  record.breakMinutes = live.breakMinutes
  record.status = deriveStatus({
    current: record.status as AttendanceStatus,
    checkedOut: true,
    workingMinutes: live.workingMinutes,
    expectedMinutes: org.expectedMinutes,
    wfh: record.status === "wfh",
    late: record.status === "late",
  })
  await record.save()

  await recordActivity(auth.organizationId, {
    title: `${employeeName(employee)} checked out`,
    detail: formatTimeInTimeZone(org.now, org.timezone),
    tone: "muted",
  })

  return getToday(auth)
}

export async function startBreak(auth: AuthContext) {
  const org = await loadOrgContext(auth.organizationId)
  const employee = await requireMyEmployee(auth)
  const record = await loadRecord(auth.organizationId, String(employee._id), org.today)

  if (!record?.checkIn || record.checkOut) {
    throw AppError.badRequest(MESSAGES.NOT_CHECKED_IN)
  }

  if (record.breakStartedAt) {
    throw AppError.conflict(MESSAGES.ALREADY_ON_BREAK)
  }

  record.breakStartedAt = org.now
  await record.save()
  return getToday(auth)
}

export async function endBreak(auth: AuthContext) {
  const org = await loadOrgContext(auth.organizationId)
  const employee = await requireMyEmployee(auth)
  const record = await loadRecord(auth.organizationId, String(employee._id), org.today)

  if (!record?.breakStartedAt) {
    throw AppError.badRequest(MESSAGES.NOT_ON_BREAK)
  }

  const extra = Math.max(0, Math.round((org.now.getTime() - record.breakStartedAt.getTime()) / 60_000))
  record.breakMinutes += extra
  record.breakStartedAt = null
  await record.save()
  return getToday(auth)
}

export async function getCalendar(auth: AuthContext, query: AttendanceCalendarQueryInput) {
  const org = await loadOrgContext(auth.organizationId)
  const month = query.month ?? org.todayKey.slice(0, 7)
  const { keys, start, end } = monthDateKeys(month)
  const employee = query.employeeId
    ? await assertEmployeeInScope(auth, query.employeeId)
    : await requireMyEmployee(auth)
  const employeeId = String(employee._id)
  const rangeEnd = new Date(end.getTime() + 86_400_000)

  const [records, holidays, leaves] = await Promise.all([
    AttendanceModel.find({
      organizationId: auth.organizationId,
      employeeId,
      date: { $gte: start, $lt: rangeEnd },
    }).lean<AttendanceLean[]>(),
    HolidayModel.find({
      organizationId: auth.organizationId,
      date: { $gte: start, $lt: rangeEnd },
    })
      .select("date name")
      .lean(),
    LeaveRequestModel.find({
      organizationId: auth.organizationId,
      employeeId,
      status: "approved",
      startDate: { $lte: end },
      endDate: { $gte: start },
    })
      .select("startDate endDate")
      .lean(),
  ])

  const recordByDate = new Map(records.map((row) => [dateKeyFromDate(row.date), row]))
  const holidayByDate = new Map(holidays.map((row) => [dateKeyFromDate(row.date), row.name]))

  const days = keys.map((dateKey) => {
    const record = recordByDate.get(dateKey)
    const workingDay = isWorkingDateKey(dateKey, org.workingDays)
    const holiday = holidayByDate.get(dateKey) ?? null
    const onLeave = leaves.some((leave) => {
      const startKey = dateKeyFromDate(leave.startDate)
      const endKey = dateKeyFromDate(leave.endDate)
      return startKey <= dateKey && endKey >= dateKey
    })
    let status: AttendanceStatus | "rest" | "absent" | null = record?.status ?? null
    if (!status) {
      if (onLeave) status = "leave"
      else if (holiday) status = "holiday"
      else if (!workingDay) status = "rest"
      else if (dateKey < org.todayKey) status = "absent"
    }

    const live = record ? liveMinutes(record, org.now, org.expectedMinutes) : null

    return {
      date: dateKey,
      isToday: dateKey === org.todayKey,
      isWorkingDay: workingDay,
      status,
      holiday,
      workingMinutes: live?.workingMinutes ?? 0,
      checkIn: record?.checkIn ? formatTimeInTimeZone(record.checkIn, org.timezone) : null,
      checkOut: record?.checkOut ? formatTimeInTimeZone(record.checkOut, org.timezone) : null,
    }
  })

  return {
    month,
    timezone: org.timezone,
    weekStartsOn: org.weekStartsOn,
    today: org.todayKey,
    employee: toEmployeeCard(employee),
    days,
  }
}

export async function listAttendance(auth: AuthContext, query: AttendanceListQueryInput) {
  const org = await loadOrgContext(auth.organizationId)
  const scopedIds = await scopedEmployeeIds(auth)
  const from = query.from ? utcDateFromKey(query.from) : utcDateFromKey(`${org.todayKey.slice(0, 7)}-01`)
  const toKey = query.to ?? org.todayKey
  const to = new Date(utcDateFromKey(toKey).getTime() + 86_400_000)

  const employeeFilter: Record<string, unknown> = { organizationId: auth.organizationId }
  if (scopedIds) employeeFilter._id = { $in: scopedIds }
  if (query.employeeId) {
    await assertEmployeeInScope(auth, query.employeeId)
    employeeFilter._id = new mongoose.Types.ObjectId(query.employeeId)
  }
  if (query.departmentId) employeeFilter.departmentId = query.departmentId
  const attendanceSearch = resolvedSearch(query)
  if (attendanceSearch) {
    const regex = new RegExp(escapeRegex(attendanceSearch), "i")
    employeeFilter.$or = [{ firstName: regex }, { lastName: regex }, { employeeCode: regex }]
  }

  const employees = await EmployeeModel.find(employeeFilter).select("_id").lean()
  const employeeIds = employees.map((row) => row._id)
  const attendanceFilter: Record<string, unknown> = {
    organizationId: auth.organizationId,
    date: { $gte: from, $lt: to },
    employeeId: { $in: employeeIds },
  }
  if (query.status) attendanceFilter.status = query.status

  const pagination = { page: query.page, limit: query.limit }
  const [items, total] = await Promise.all([
    AttendanceModel.find(attendanceFilter)
      .populate(EMPLOYEE_POPULATE)
      .sort(mongoSort(query, { date: -1, checkIn: -1 }))
      .skip(paginationSkip(pagination))
      .limit(pagination.limit)
      .lean<AttendanceLean[]>(),
    AttendanceModel.countDocuments(attendanceFilter),
  ])

  return {
    timezone: org.timezone,
    items: items.map((item) => toPublicAttendance(item, org.now, org.expectedMinutes, org.timezone)),
    ...paginationMeta(total, pagination),
  }
}

export async function getDailyOverview(auth: AuthContext, query: AttendanceDailyQueryInput) {
  const org = await loadOrgContext(auth.organizationId)
  const dateKey = query.date ?? org.todayKey
  const date = utcDateFromKey(dateKey)
  const nextDay = new Date(date.getTime() + 86_400_000)
  const scopedIds = await scopedEmployeeIds(auth)
  const workingDay = isWorkingDateKey(dateKey, org.workingDays)

  const employeeFilter: Record<string, unknown> = {
    organizationId: auth.organizationId,
    employmentStatus: { $in: ["active", "on_leave"] },
  }
  if (scopedIds) employeeFilter._id = { $in: scopedIds }
  if (query.departmentId) employeeFilter.departmentId = query.departmentId
  const dailySearch = resolvedSearch(query)
  if (dailySearch) {
    const regex = new RegExp(escapeRegex(dailySearch), "i")
    employeeFilter.$or = [{ firstName: regex }, { lastName: regex }, { employeeCode: regex }]
  }

  const [employees, holiday, leaves, records] = await Promise.all([
    EmployeeModel.find(employeeFilter)
      .populate({ path: "departmentId", select: "name" })
      .sort(mongoSort(query, { firstName: 1, lastName: 1 }))
      .lean<PopulatedEmployee[]>(),
    HolidayModel.findOne({ organizationId: auth.organizationId, date }).select("name").lean(),
    LeaveRequestModel.find({
      organizationId: auth.organizationId,
      status: "approved",
      startDate: { $lte: date },
      endDate: { $gte: date },
      ...(scopedIds ? { employeeId: { $in: scopedIds } } : {}),
    })
      .select("employeeId")
      .lean(),
    AttendanceModel.find({
      organizationId: auth.organizationId,
      date,
      ...(scopedIds ? { employeeId: { $in: scopedIds } } : {}),
    }).lean<AttendanceLean[]>(),
  ])

  const recordByEmployee = new Map(records.map((row) => [asId(row.employeeId), row]))
  const leaveIds = new Set(leaves.map((row) => asId(row.employeeId)))
  const holidayName = holiday?.name ?? null

  const rows = employees.map((employee) => {
    const id = String(employee._id)
    const record = recordByEmployee.get(id)
    let status: AttendanceStatus | "rest" = record?.status ?? "absent"
    if (!record) {
      if (leaveIds.has(id)) status = "leave"
      else if (holidayName) status = "holiday"
      else if (!workingDay) status = "rest"
      else status = "absent"
    }

    return {
      employee: toEmployeeCard(employee),
      status,
      attendance: record
        ? toPublicAttendance(record, org.now, org.expectedMinutes, org.timezone)
        : null,
    }
  })

  const filtered = query.status ? rows.filter((row) => row.status === query.status) : rows
  const pagination = { page: query.page, limit: query.limit }
  const items = filtered.slice(paginationSkip(pagination), paginationSkip(pagination) + pagination.limit)

  const summary = {
    expected: workingDay ? employees.length : 0,
    present: rows.filter((row) => PRESENT_SET.has(row.status)).length,
    late: rows.filter((row) => row.status === "late").length,
    absent: rows.filter((row) => row.status === "absent").length,
    wfh: rows.filter((row) => row.status === "wfh").length,
    leave: rows.filter((row) => row.status === "leave").length,
    holiday: rows.filter((row) => row.status === "holiday").length,
    halfDay: rows.filter((row) => row.status === "half_day").length,
  }

  return {
    date: dateKey,
    timezone: org.timezone,
    workingHours: org.workingHours,
    isWorkingDay: workingDay,
    holiday: holidayName,
    summary,
    items,
    ...paginationMeta(filtered.length, pagination),
  }
}

export async function getMonthlyReport(auth: AuthContext, query: AttendanceMonthlyQueryInput) {
  const org = await loadOrgContext(auth.organizationId)
  const month = query.month ?? org.todayKey.slice(0, 7)
  const { keys, start, end } = monthDateKeys(month)
  const rangeEnd = new Date(end.getTime() + 86_400_000)
  const workingKeys = keys.filter((key) => isWorkingDateKey(key, org.workingDays) && key <= org.todayKey)
  const scopedIds = await scopedEmployeeIds(auth)

  const employeeFilter: Record<string, unknown> = {
    organizationId: auth.organizationId,
    employmentStatus: { $in: ["active", "on_leave", "inactive"] },
  }
  if (scopedIds) employeeFilter._id = { $in: scopedIds }
  if (query.departmentId) employeeFilter.departmentId = query.departmentId
  const monthlySearch = resolvedSearch(query)
  if (monthlySearch) {
    const regex = new RegExp(escapeRegex(monthlySearch), "i")
    employeeFilter.$or = [{ firstName: regex }, { lastName: regex }, { employeeCode: regex }]
  }

  const [employees, records, holidays, leaves] = await Promise.all([
    EmployeeModel.find(employeeFilter)
      .populate({ path: "departmentId", select: "name" })
      .sort(mongoSort(query, { firstName: 1, lastName: 1 }))
      .lean<PopulatedEmployee[]>(),
    AttendanceModel.find({
      organizationId: auth.organizationId,
      date: { $gte: start, $lt: rangeEnd },
      ...(scopedIds ? { employeeId: { $in: scopedIds } } : {}),
    }).lean<AttendanceLean[]>(),
    HolidayModel.find({
      organizationId: auth.organizationId,
      date: { $gte: start, $lt: rangeEnd },
    })
      .select("date")
      .lean(),
    LeaveRequestModel.find({
      organizationId: auth.organizationId,
      status: "approved",
      startDate: { $lte: end },
      endDate: { $gte: start },
      ...(scopedIds ? { employeeId: { $in: scopedIds } } : {}),
    })
      .select("employeeId startDate endDate")
      .lean(),
  ])

  const holidayKeys = new Set(holidays.map((row) => dateKeyFromDate(row.date)))
  const recordsByEmployee = new Map<string, AttendanceLean[]>()
  for (const record of records) {
    const id = asId(record.employeeId)
    const list = recordsByEmployee.get(id) ?? []
    list.push(record)
    recordsByEmployee.set(id, list)
  }

  const items = employees.map((employee) => {
    const id = String(employee._id)
    const mine = recordsByEmployee.get(id) ?? []
    const byDate = new Map(mine.map((row) => [dateKeyFromDate(row.date), row]))
    const counts = {
      present: 0,
      late: 0,
      halfDay: 0,
      wfh: 0,
      leave: 0,
      holiday: 0,
      absent: 0,
      workingMinutes: 0,
      overtimeMinutes: 0,
    }

    for (const key of workingKeys) {
      const record = byDate.get(key)
      if (record) {
        if (record.status === "late") counts.late += 1
        else if (record.status === "half_day") counts.halfDay += 1
        else if (record.status === "wfh") counts.wfh += 1
        else if (record.status === "leave") counts.leave += 1
        else if (record.status === "holiday") counts.holiday += 1
        else if (PRESENT_SET.has(record.status)) counts.present += 1
        else if (record.status === "absent") counts.absent += 1
        const live = liveMinutes(record, org.now, org.expectedMinutes)
        counts.workingMinutes += live.workingMinutes
        counts.overtimeMinutes += live.overtimeMinutes
        continue
      }

      const onLeave = leaves.some((leave) => {
        if (asId(leave.employeeId) !== id) return false
        const startKey = dateKeyFromDate(leave.startDate)
        const endKey = dateKeyFromDate(leave.endDate)
        return startKey <= key && endKey >= key
      })

      if (onLeave) counts.leave += 1
      else if (holidayKeys.has(key)) counts.holiday += 1
      else counts.absent += 1
    }

    return {
      employee: toEmployeeCard(employee),
      expectedDays: workingKeys.length,
      ...counts,
    }
  })

  const pagination = { page: query.page, limit: query.limit }

  return {
    month,
    timezone: org.timezone,
    expectedDays: workingKeys.length,
    items: items.slice(paginationSkip(pagination), paginationSkip(pagination) + pagination.limit),
    ...paginationMeta(items.length, pagination),
  }
}

export async function getAttendance(auth: AuthContext, id: string) {
  parseObjectId(id)
  const org = await loadOrgContext(auth.organizationId)
  const record = await AttendanceModel.findOne({
    _id: id,
    organizationId: auth.organizationId,
  })
    .populate(EMPLOYEE_POPULATE)
    .lean<AttendanceLean>()

  if (!record) {
    throw AppError.notFound("Attendance record not found")
  }

  await assertEmployeeInScope(auth, asId(record.employeeId))
  return toPublicAttendance(record, org.now, org.expectedMinutes, org.timezone)
}

export async function updateAttendance(auth: AuthContext, id: string, input: UpdateAttendanceInput) {
  parseObjectId(id)
  const org = await loadOrgContext(auth.organizationId)
  const record = await AttendanceModel.findOne({
    _id: id,
    organizationId: auth.organizationId,
  })

  if (!record) {
    throw AppError.notFound("Attendance record not found")
  }

  if (input.status !== undefined) record.status = input.status
  if (input.notes !== undefined) record.notes = input.notes
  if (input.checkIn !== undefined) record.checkIn = input.checkIn ? new Date(input.checkIn) : null
  if (input.checkOut !== undefined) record.checkOut = input.checkOut ? new Date(input.checkOut) : null
  if (input.breakMinutes !== undefined) record.breakMinutes = input.breakMinutes
  record.breakStartedAt = null
  record.source = "hr"

  const live = liveMinutes(record, record.checkOut ?? org.now, org.expectedMinutes)
  record.workingMinutes = live.workingMinutes
  record.overtimeMinutes = live.overtimeMinutes
  if (input.breakMinutes === undefined) {
    record.breakMinutes = live.breakMinutes
  }
  await record.save()

  const populated = await AttendanceModel.findById(record._id)
    .populate(EMPLOYEE_POPULATE)
    .lean<AttendanceLean>()

  return toPublicAttendance(populated!, org.now, org.expectedMinutes, org.timezone)
}
