import mongoose from "mongoose"

import {
  ACTIVE_LEAVE_REQUEST_STATUSES,
  DEFAULT_LEAVE_TYPES,
} from "../constants/leave.js"
import { MESSAGES } from "../constants/messages.js"
import { DEFAULT_WORKING_DAYS } from "../constants/organization.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { EmployeeModel } from "../models/employee.model.js"
import { HolidayModel } from "../models/holiday.model.js"
import { LeaveBalanceModel } from "../models/leave-balance.model.js"
import { LeaveRequestModel } from "../models/leave-request.model.js"
import { LeaveTypeModel } from "../models/leave-type.model.js"
import { OrganizationModel } from "../models/organization.model.js"
import type { AuthContext } from "../types/auth.js"
import { hasAnyPermission } from "../utils/access.js"
import { recordActivity } from "../utils/activity.js"
import { notifyLeaveDecided, notifyLeaveSubmitted } from "../notifications/index.js"
import { AppError } from "../utils/app-error.js"
import {
  countLeaveDays,
  dateKeyFromDate,
  dateKeyInTimeZone,
  formatLeaveRange,
  initialsFromName,
  isWorkingDateKey,
  monthDateKeys,
  utcDateFromKey,
} from "../utils/dates.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { escapeRegex, mongoSort, resolvedSearch } from "../utils/search.js"
import type {
  ApplyLeaveInput,
  CreateLeaveTypeInput,
  DecideLeaveInput,
  LeaveBalanceQueryInput,
  LeaveCalendarQueryInput,
  LeaveListQueryInput,
  LeavePreviewQueryInput,
  UpdateLeaveTypeInput,
} from "../validators/leave.validators.js"

const DEFAULT_TIMEZONE = "Asia/Kolkata"

type OrgContext = {
  timezone: string
  workingDays: string[]
  weekStartsOn: string
  todayKey: string
  today: Date
  now: Date
  year: number
}

type EmployeeCard = {
  _id: mongoose.Types.ObjectId
  firstName: string
  lastName: string
  profileImage?: string
  employeeCode?: string
  userId?: mongoose.Types.ObjectId
  managerId?: mongoose.Types.ObjectId | null
  departmentId?: { name?: string } | mongoose.Types.ObjectId | null
}

const REQUEST_POPULATE = [
  {
    path: "employeeId",
    select: "firstName lastName profileImage employeeCode userId managerId departmentId",
    populate: { path: "departmentId", select: "name" },
  },
  { path: "leaveTypeId", select: "name code isPaid isActive" },
  { path: "approvedBy", select: "name" },
] as const

function isDuplicateKey(error: unknown, field: string) {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 11000) {
    return false
  }

  const key =
    "keyPattern" in error && error.keyPattern && typeof error.keyPattern === "object"
      ? error.keyPattern
      : null

  return Boolean(key && field in key)
}

function asId(value: unknown) {
  if (!value) return ""
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id: unknown })._id)
  }
  return String(value)
}

function employeeName(employee: { firstName?: string; lastName?: string }) {
  return `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim() || "Unknown"
}

function toEmployeeCard(employee: EmployeeCard) {
  const name = employeeName(employee)
  const department =
    employee.departmentId && typeof employee.departmentId === "object" && "name" in employee.departmentId
      ? employee.departmentId.name ?? null
      : null

  return {
    id: String(employee._id),
    name,
    initials: initialsFromName(name),
    profileImage: employee.profileImage ?? "",
    employeeCode: employee.employeeCode ?? "",
    department,
  }
}

function toPublicType(doc: Record<string, unknown>) {
  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    name: String(doc.name),
    code: String(doc.code),
    maxDays: Number(doc.maxDays),
    isPaid: Boolean(doc.isPaid),
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt ?? ""),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt ?? ""),
  }
}

function toPublicRequest(doc: Record<string, unknown>, timezone: string) {
  const employee =
    doc.employeeId && typeof doc.employeeId === "object" && "firstName" in doc.employeeId
      ? toEmployeeCard(doc.employeeId as EmployeeCard)
      : null
  const leaveType =
    doc.leaveTypeId && typeof doc.leaveTypeId === "object" && "name" in doc.leaveTypeId
      ? (doc.leaveTypeId as { _id: unknown; name: string; code?: string; isPaid?: boolean })
      : null
  const approver =
    doc.approvedBy && typeof doc.approvedBy === "object" && "name" in doc.approvedBy
      ? (doc.approvedBy as { _id: unknown; name: string })
      : null
  const startDate = doc.startDate instanceof Date ? dateKeyFromDate(doc.startDate) : String(doc.startDate ?? "")
  const endDate = doc.endDate instanceof Date ? dateKeyFromDate(doc.endDate) : String(doc.endDate ?? "")

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    employeeId: employee?.id ?? asId(doc.employeeId),
    employee,
    leaveTypeId: leaveType ? String(leaveType._id) : asId(doc.leaveTypeId),
    leaveType: leaveType
      ? { id: String(leaveType._id), name: leaveType.name, code: leaveType.code ?? "", isPaid: Boolean(leaveType.isPaid) }
      : null,
    startDate,
    endDate,
    range: formatLeaveRange(startDate, endDate),
    totalDays: Number(doc.totalDays),
    reason: String(doc.reason ?? ""),
    attachment: typeof doc.attachment === "string" ? doc.attachment : "",
    status: String(doc.status),
    approvedBy: approver ? { id: String(approver._id), name: approver.name } : null,
    approvalComment: String(doc.approvalComment ?? ""),
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt ?? ""),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt ?? ""),
    timezone,
  }
}

async function loadOrgContext(organizationId: string, now = new Date()): Promise<OrgContext> {
  const organization = await OrganizationModel.findById(organizationId)
    .select("timezone workingDays settings")
    .lean()
  const timezone = organization?.timezone || DEFAULT_TIMEZONE
  const workingDays =
    organization?.workingDays && organization.workingDays.length > 0
      ? organization.workingDays
      : [...DEFAULT_WORKING_DAYS]
  const todayKey = dateKeyInTimeZone(now, timezone)

  return {
    timezone,
    workingDays,
    weekStartsOn: organization?.settings?.weekStartsOn || "monday",
    todayKey,
    today: utcDateFromKey(todayKey),
    now,
    year: Number(todayKey.slice(0, 4)),
  }
}

async function leaveEmployeeFilter(auth: AuthContext) {
  if (hasAnyPermission(auth.role, [PERMISSIONS.LEAVE_READ, PERMISSIONS.LEAVE_MANAGE])) {
    return { organizationId: auth.organizationId } as Record<string, unknown>
  }

  if (hasAnyPermission(auth.role, [PERMISSIONS.LEAVE_READ_TEAM, PERMISSIONS.LEAVE_APPROVE_TEAM])) {
    const mine = await EmployeeModel.findOne({
      organizationId: auth.organizationId,
      userId: auth.userId,
    })
      .select("_id")
      .lean()

    return {
      organizationId: auth.organizationId,
      $or: mine ? [{ userId: auth.userId }, { managerId: mine._id }] : [{ userId: auth.userId }],
    } as Record<string, unknown>
  }

  if (hasAnyPermission(auth.role, [PERMISSIONS.LEAVE_READ_SELF, PERMISSIONS.LEAVE_CREATE_SELF])) {
    return { organizationId: auth.organizationId, userId: auth.userId } as Record<string, unknown>
  }

  throw AppError.forbidden()
}

async function requireMyEmployee(auth: AuthContext) {
  const employee = await EmployeeModel.findOne({
    organizationId: auth.organizationId,
    userId: auth.userId,
  }).lean<EmployeeCard>()

  if (!employee) {
    throw AppError.notFound(MESSAGES.NO_EMPLOYEE_PROFILE)
  }

  return employee
}

async function assertEmployeeInScope(auth: AuthContext, employeeId: string) {
  parseObjectId(employeeId)
  const filter = await leaveEmployeeFilter(auth)
  const employee = await EmployeeModel.findOne({ ...filter, _id: employeeId }).lean<EmployeeCard>()
  if (!employee) {
    throw AppError.forbidden()
  }
  return employee
}

async function canDecide(auth: AuthContext, employee: EmployeeCard) {
  if (asId(employee.userId) === auth.userId) {
    throw AppError.forbidden(MESSAGES.LEAVE_CANNOT_APPROVE_SELF)
  }

  if (hasAnyPermission(auth.role, [PERMISSIONS.LEAVE_MANAGE])) {
    return
  }

  if (hasAnyPermission(auth.role, [PERMISSIONS.LEAVE_APPROVE_TEAM])) {
    const mine = await EmployeeModel.findOne({
      organizationId: auth.organizationId,
      userId: auth.userId,
    })
      .select("_id")
      .lean()

    if (mine && asId(employee.managerId) === String(mine._id)) {
      return
    }
  }

  throw AppError.forbidden()
}

export async function ensureLeaveTypes(organizationId: string) {
  const count = await LeaveTypeModel.countDocuments({ organizationId })
  if (count > 0) {
    return LeaveTypeModel.find({ organizationId }).sort({ name: 1 }).lean()
  }

  await LeaveTypeModel.insertMany(
    DEFAULT_LEAVE_TYPES.map((item) => ({
      organizationId,
      ...item,
      isActive: true,
    }))
  )

  return LeaveTypeModel.find({ organizationId }).sort({ name: 1 }).lean()
}

export async function ensureEmployeeLeaveBalances(
  organizationId: string,
  employeeId: string,
  year: number
) {
  const types = await ensureLeaveTypes(organizationId)
  const existing = await LeaveBalanceModel.find({ organizationId, employeeId, year })
    .select("leaveTypeId")
    .lean()
  const have = new Set(existing.map((row) => String(row.leaveTypeId)))
  const missing = types.filter((type) => type.isActive !== false && !have.has(String(type._id)))

  if (missing.length > 0) {
    await LeaveBalanceModel.insertMany(
      missing.map((type) => ({
        organizationId,
        employeeId,
        leaveTypeId: type._id,
        year,
        total: type.maxDays,
        used: 0,
        remaining: type.maxDays,
      }))
    )
  }
}

async function holidayKeysForRange(organizationId: string, start: Date, end: Date) {
  const holidays = await HolidayModel.find({
    organizationId,
    date: { $gte: start, $lte: end },
  })
    .select("date")
    .lean()

  return new Set(holidays.map((row) => dateKeyFromDate(row.date)))
}

async function computeTotalDays(auth: AuthContext, startKey: string, endKey: string) {
  const org = await loadOrgContext(auth.organizationId)
  const start = utcDateFromKey(startKey)
  const end = utcDateFromKey(endKey)
  const holidays = await holidayKeysForRange(auth.organizationId, start, end)
  const totalDays = countLeaveDays(startKey, endKey, org.workingDays, holidays)

  if (totalDays <= 0) {
    throw AppError.badRequest(MESSAGES.LEAVE_NO_WORKING_DAYS)
  }

  return { org, totalDays, start, end }
}

async function assertNoOverlap(
  organizationId: string,
  employeeId: string,
  start: Date,
  end: Date,
  excludeId?: string
) {
  const overlap = await LeaveRequestModel.findOne({
    organizationId,
    employeeId,
    status: { $in: [...ACTIVE_LEAVE_REQUEST_STATUSES] },
    startDate: { $lte: end },
    endDate: { $gte: start },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select("_id")

  if (overlap) {
    throw AppError.conflict(MESSAGES.LEAVE_OVERLAP)
  }
}

async function pendingDays(
  organizationId: string,
  employeeId: string,
  leaveTypeId: string,
  year: number,
  excludeId?: string
) {
  const start = utcDateFromKey(`${year}-01-01`)
  const end = utcDateFromKey(`${year}-12-31`)
  const rows = await LeaveRequestModel.find({
    organizationId,
    employeeId,
    leaveTypeId,
    status: "pending",
    startDate: { $lte: end },
    endDate: { $gte: start },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select("totalDays")
    .lean()

  return rows.reduce((sum, row) => sum + Number(row.totalDays), 0)
}

export async function listLeaveTypes(auth: AuthContext) {
  const types = await ensureLeaveTypes(auth.organizationId)
  const activeOnly = !hasAnyPermission(auth.role, [PERMISSIONS.LEAVE_MANAGE])
  return types.filter((type) => !activeOnly || type.isActive !== false).map((type) => toPublicType(type))
}

export async function createLeaveType(auth: AuthContext, input: CreateLeaveTypeInput) {
  try {
    const created = await LeaveTypeModel.create({
      organizationId: auth.organizationId,
      name: input.name,
      code: input.code.toUpperCase(),
      maxDays: input.maxDays,
      isPaid: input.isPaid ?? true,
      isActive: input.isActive ?? true,
    })
    return toPublicType(created.toObject())
  } catch (error) {
    if (isDuplicateKey(error, "code")) {
      throw AppError.conflict(MESSAGES.LEAVE_TYPE_CODE_IN_USE)
    }
    if (isDuplicateKey(error, "name")) {
      throw AppError.conflict(MESSAGES.LEAVE_TYPE_NAME_IN_USE)
    }
    throw error
  }
}

export async function updateLeaveType(auth: AuthContext, id: string, input: UpdateLeaveTypeInput) {
  parseObjectId(id)
  const type = await LeaveTypeModel.findOne({ _id: id, organizationId: auth.organizationId })
  if (!type) {
    throw AppError.notFound("Leave type not found")
  }

  if (input.name !== undefined) type.name = input.name
  if (input.code !== undefined) type.code = input.code.toUpperCase()
  if (input.maxDays !== undefined) type.maxDays = input.maxDays
  if (input.isPaid !== undefined) type.isPaid = input.isPaid
  if (input.isActive !== undefined) type.isActive = input.isActive

  try {
    await type.save()
  } catch (error) {
    if (isDuplicateKey(error, "code") || isDuplicateKey(error, "name")) {
      throw AppError.conflict(MESSAGES.LEAVE_TYPE_CODE_IN_USE)
    }
    throw error
  }

  return toPublicType(type.toObject())
}

export async function listBalances(auth: AuthContext, query: LeaveBalanceQueryInput) {
  const org = await loadOrgContext(auth.organizationId)
  const year = query.year ?? org.year
  const employee = query.employeeId
    ? await assertEmployeeInScope(auth, query.employeeId)
    : await requireMyEmployee(auth)

  await ensureEmployeeLeaveBalances(auth.organizationId, String(employee._id), year)

  const items = await LeaveBalanceModel.find({
    organizationId: auth.organizationId,
    employeeId: employee._id,
    year,
  })
    .populate({ path: "leaveTypeId", select: "name code isPaid isActive maxDays" })
    .lean()

  const pending = await LeaveRequestModel.aggregate<{ _id: mongoose.Types.ObjectId; days: number }>([
    {
      $match: {
        organizationId: new mongoose.Types.ObjectId(auth.organizationId),
        employeeId: employee._id,
        status: "pending",
        startDate: { $gte: utcDateFromKey(`${year}-01-01`), $lte: utcDateFromKey(`${year}-12-31`) },
      },
    },
    { $group: { _id: "$leaveTypeId", days: { $sum: "$totalDays" } } },
  ])
  const pendingByType = new Map(pending.map((row) => [String(row._id), row.days]))

  return {
    year,
    employee: toEmployeeCard(employee),
    items: items
      .filter((row) => {
        const type = row.leaveTypeId as unknown as { isActive?: boolean } | null
        return type && type.isActive !== false
      })
      .map((row) => {
        const type = row.leaveTypeId as unknown as {
          _id: unknown
          name: string
          code: string
          isPaid?: boolean
          maxDays?: number
        }
        const pendingDays = pendingByType.get(String(type._id)) ?? 0
        return {
          id: String(row._id),
          leaveType: {
            id: String(type._id),
            name: type.name,
            code: type.code,
            isPaid: Boolean(type.isPaid),
            maxDays: Number(type.maxDays ?? row.total),
          },
          year,
          total: row.total,
          used: row.used,
          remaining: row.remaining,
          pending: pendingDays,
          available: Math.max(0, row.remaining - pendingDays),
        }
      }),
  }
}

export async function previewLeave(auth: AuthContext, query: LeavePreviewQueryInput) {
  const { org, totalDays, start, end } = await computeTotalDays(auth, query.startDate, query.endDate)
  return {
    timezone: org.timezone,
    startDate: query.startDate,
    endDate: query.endDate,
    totalDays,
    range: formatLeaveRange(query.startDate, query.endDate),
    from: start.toISOString(),
    to: end.toISOString(),
  }
}

export async function applyLeave(auth: AuthContext, input: ApplyLeaveInput) {
  const employee = await requireMyEmployee(auth)
  const { org, totalDays, start, end } = await computeTotalDays(auth, input.startDate, input.endDate)
  const leaveType = await LeaveTypeModel.findOne({
    _id: input.leaveTypeId,
    organizationId: auth.organizationId,
  })

  if (!leaveType || leaveType.isActive === false) {
    throw AppError.badRequest(MESSAGES.LEAVE_TYPE_INACTIVE)
  }

  await assertNoOverlap(auth.organizationId, String(employee._id), start, end)
  await ensureEmployeeLeaveBalances(auth.organizationId, String(employee._id), org.year)

  const balance = await LeaveBalanceModel.findOne({
    organizationId: auth.organizationId,
    employeeId: employee._id,
    leaveTypeId: leaveType._id,
    year: org.year,
  })

  if (!balance) {
    throw AppError.badRequest(MESSAGES.LEAVE_INSUFFICIENT_BALANCE)
  }

  const held = await pendingDays(auth.organizationId, String(employee._id), String(leaveType._id), org.year)
  if (balance.remaining - held < totalDays) {
    throw AppError.badRequest(MESSAGES.LEAVE_INSUFFICIENT_BALANCE)
  }

  const created = await LeaveRequestModel.create({
    organizationId: auth.organizationId,
    employeeId: employee._id,
    leaveTypeId: leaveType._id,
    startDate: start,
    endDate: end,
    totalDays,
    reason: input.reason,
    attachment: input.attachment ?? "",
    status: "pending",
  })

  await recordActivity(auth.organizationId, {
    title: `${employeeName(employee)} submitted leave`,
    detail: `${leaveType.name} · ${formatLeaveRange(input.startDate, input.endDate)}`,
    tone: "warning",
  })

  await notifyLeaveSubmitted({
    organizationId: auth.organizationId,
    actorUserId: auth.userId,
    employeeName: employeeName(employee),
    managerId: employee.managerId,
    leaveTypeName: leaveType.name,
    range: formatLeaveRange(input.startDate, input.endDate),
    requestId: String(created._id),
  })

  const populated = await LeaveRequestModel.findById(created._id)
    .populate([...REQUEST_POPULATE])
    .lean()

  return toPublicRequest(populated as Record<string, unknown>, org.timezone)
}

export async function listLeaveRequests(auth: AuthContext, query: LeaveListQueryInput) {
  const org = await loadOrgContext(auth.organizationId)
  const filter = await leaveEmployeeFilter(auth)
  const employees = await EmployeeModel.find(filter).select("_id").lean()
  let employeeIds = employees.map((row) => row._id)

  if (query.employeeId) {
    await assertEmployeeInScope(auth, query.employeeId)
    employeeIds = employeeIds.filter((id) => String(id) === query.employeeId)
  }

  const search = resolvedSearch(query)
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i")
    const matched = await EmployeeModel.find({
      organizationId: auth.organizationId,
      _id: { $in: employeeIds },
      $or: [{ firstName: regex }, { lastName: regex }, { employeeCode: regex }],
    })
      .select("_id")
      .lean()
    employeeIds = matched.map((row) => row._id)
  }

  const requestFilter: Record<string, unknown> = {
    organizationId: auth.organizationId,
    employeeId: { $in: employeeIds },
  }
  if (query.status) requestFilter.status = query.status
  if (query.leaveTypeId) requestFilter.leaveTypeId = query.leaveTypeId
  if (query.from || query.to) {
    const from = query.from ? utcDateFromKey(query.from) : utcDateFromKey("2000-01-01")
    const to = query.to ? utcDateFromKey(query.to) : utcDateFromKey("2100-12-31")
    requestFilter.startDate = { $lte: to }
    requestFilter.endDate = { $gte: from }
  }

  const pagination = { page: query.page, limit: query.limit }
  const [items, total] = await Promise.all([
    LeaveRequestModel.find(requestFilter)
      .populate([...REQUEST_POPULATE])
      .sort(mongoSort(query, { createdAt: -1 }))
      .skip(paginationSkip(pagination))
      .limit(pagination.limit)
      .lean(),
    LeaveRequestModel.countDocuments(requestFilter),
  ])

  return {
    timezone: org.timezone,
    items: items.map((item) => toPublicRequest(item as Record<string, unknown>, org.timezone)),
    ...paginationMeta(total, pagination),
  }
}

export async function getLeaveRequest(auth: AuthContext, id: string) {
  parseObjectId(id)
  const org = await loadOrgContext(auth.organizationId)
  const request = await LeaveRequestModel.findOne({
    _id: id,
    organizationId: auth.organizationId,
  })
    .populate([...REQUEST_POPULATE])
    .lean()

  if (!request) {
    throw AppError.notFound("Leave request not found")
  }

  await assertEmployeeInScope(auth, asId(request.employeeId))
  return toPublicRequest(request as Record<string, unknown>, org.timezone)
}

export async function cancelLeave(auth: AuthContext, id: string) {
  parseObjectId(id)
  const org = await loadOrgContext(auth.organizationId)
  const request = await LeaveRequestModel.findOne({
    _id: id,
    organizationId: auth.organizationId,
  }).populate({ path: "employeeId", select: "userId firstName lastName" })

  if (!request) {
    throw AppError.notFound("Leave request not found")
  }

  if (request.status !== "pending") {
    throw AppError.badRequest(MESSAGES.LEAVE_NOT_PENDING)
  }

  const employee = request.employeeId as unknown as EmployeeCard
  const isOwn = asId(employee.userId) === auth.userId
  if (!isOwn && !hasAnyPermission(auth.role, [PERMISSIONS.LEAVE_MANAGE])) {
    throw AppError.forbidden()
  }

  request.status = "cancelled"
  await request.save()

  const populated = await LeaveRequestModel.findById(request._id)
    .populate([...REQUEST_POPULATE])
    .lean()

  return toPublicRequest(populated as Record<string, unknown>, org.timezone)
}

async function decideLeave(auth: AuthContext, id: string, status: "approved" | "rejected", input: DecideLeaveInput) {
  parseObjectId(id)
  const org = await loadOrgContext(auth.organizationId)
  const request = await LeaveRequestModel.findOne({
    _id: id,
    organizationId: auth.organizationId,
  })

  if (!request) {
    throw AppError.notFound("Leave request not found")
  }

  if (request.status !== "pending") {
    throw AppError.badRequest(MESSAGES.LEAVE_NOT_PENDING)
  }

  const employee = await EmployeeModel.findOne({
    _id: request.employeeId,
    organizationId: auth.organizationId,
  }).lean<EmployeeCard>()
  if (!employee) {
    throw AppError.notFound("Employee not found")
  }

  await canDecide(auth, employee)

  if (status === "approved") {
    const year = Number(dateKeyFromDate(request.startDate).slice(0, 4))
    await ensureEmployeeLeaveBalances(auth.organizationId, String(employee._id), year)
    const updated = await LeaveBalanceModel.findOneAndUpdate(
      {
        organizationId: auth.organizationId,
        employeeId: employee._id,
        leaveTypeId: request.leaveTypeId,
        year,
        remaining: { $gte: request.totalDays },
      },
      [
        {
          $set: {
            used: { $add: ["$used", request.totalDays] },
            remaining: {
              $subtract: ["$total", { $add: ["$used", request.totalDays] }],
            },
          },
        },
      ],
      { new: true }
    )

    if (!updated) {
      throw AppError.badRequest(MESSAGES.LEAVE_INSUFFICIENT_BALANCE)
    }
  }

  request.status = status
  request.approvedBy = new mongoose.Types.ObjectId(auth.userId)
  request.approvalComment = input.comment ?? ""
  await request.save()

  const populated = await LeaveRequestModel.findById(request._id)
    .populate([...REQUEST_POPULATE])
    .lean()
  const publicRequest = toPublicRequest(populated as Record<string, unknown>, org.timezone)

  await recordActivity(auth.organizationId, {
    title:
      status === "approved"
        ? `${publicRequest.employee?.name ?? "A teammate"}’s leave was approved`
        : `${publicRequest.employee?.name ?? "A teammate"}’s leave was declined`,
    detail: publicRequest.leaveType
      ? `${publicRequest.leaveType.name} · ${publicRequest.range}`
      : publicRequest.range,
    tone: status === "approved" ? "success" : "muted",
  })

  await notifyLeaveDecided({
    organizationId: auth.organizationId,
    actorUserId: auth.userId,
    employeeUserId: employee.userId,
    approved: status === "approved",
    leaveTypeName: publicRequest.leaveType?.name ?? "Leave",
    range: publicRequest.range,
    requestId: String(request._id),
  })

  return publicRequest
}

export async function approveLeave(auth: AuthContext, id: string, input: DecideLeaveInput) {
  return decideLeave(auth, id, "approved", input)
}

export async function rejectLeave(auth: AuthContext, id: string, input: DecideLeaveInput) {
  return decideLeave(auth, id, "rejected", input)
}

export async function getLeaveCalendar(auth: AuthContext, query: LeaveCalendarQueryInput) {
  const org = await loadOrgContext(auth.organizationId)
  const month = query.month ?? org.todayKey.slice(0, 7)
  const { keys, start, end } = monthDateKeys(month)
  const filter = await leaveEmployeeFilter(auth)

  let employees = await EmployeeModel.find(filter)
    .select("firstName lastName profileImage employeeCode departmentId")
    .populate({ path: "departmentId", select: "name" })
    .lean<EmployeeCard[]>()

  if (query.employeeId) {
    await assertEmployeeInScope(auth, query.employeeId)
    employees = employees.filter((row) => String(row._id) === query.employeeId)
  }

  const employeeIds = employees.map((row) => row._id)
  const [holidays, requests] = await Promise.all([
    HolidayModel.find({
      organizationId: auth.organizationId,
      date: { $gte: start, $lte: end },
    })
      .select("date name")
      .lean(),
    LeaveRequestModel.find({
      organizationId: auth.organizationId,
      employeeId: { $in: employeeIds },
      status: { $in: [...ACTIVE_LEAVE_REQUEST_STATUSES] },
      startDate: { $lte: end },
      endDate: { $gte: start },
    })
      .populate({ path: "leaveTypeId", select: "name" })
      .populate({ path: "employeeId", select: "firstName lastName" })
      .lean(),
  ])

  const holidayByDate = new Map(holidays.map((row) => [dateKeyFromDate(row.date), row.name]))
  const mine = await EmployeeModel.findOne({
    organizationId: auth.organizationId,
    userId: auth.userId,
  })
    .select("_id")
    .lean()

  const days = keys.map((dateKey) => {
    const items = requests
      .filter((request) => {
        const startKey = dateKeyFromDate(request.startDate as Date)
        const endKey = dateKeyFromDate(request.endDate as Date)
        return startKey <= dateKey && endKey >= dateKey
      })
      .map((request) => {
        const person = request.employeeId as unknown as EmployeeCard
        const type = request.leaveTypeId as unknown as { name?: string }
        return {
          id: String(request._id),
          name: employeeName(person),
          status: String(request.status),
          type: type?.name ?? "Leave",
          isMine: mine ? String(person._id) === String(mine._id) : false,
        }
      })

    return {
      date: dateKey,
      isToday: dateKey === org.todayKey,
      isWorkingDay: isWorkingDateKey(dateKey, org.workingDays),
      holiday: holidayByDate.get(dateKey) ?? null,
      items,
    }
  })

  return {
    month,
    timezone: org.timezone,
    weekStartsOn: org.weekStartsOn,
    today: org.todayKey,
    days,
  }
}
