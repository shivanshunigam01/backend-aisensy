import { MESSAGES } from "../constants/messages.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { USER_ROLES } from "../constants/roles.js"
import { DepartmentModel } from "../models/department.model.js"
import { DesignationModel } from "../models/designation.model.js"
import { EmployeeModel } from "../models/employee.model.js"
import { UserModel } from "../models/user.model.js"
import type { AuthContext } from "../types/auth.js"
import { recordActivity } from "../utils/activity.js"
import { AppError } from "../utils/app-error.js"
import { hasAnyPermission } from "../utils/access.js"
import { generateEmployeeCode } from "../utils/employee-code.js"
import { dateKeyInTimeZone } from "../utils/dates.js"
import { parseObjectId } from "../utils/object-id.js"
import { ensureEmployeeLeaveBalances } from "./leave.service.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { escapeRegex, mongoSort, resolvedSearch } from "../utils/search.js"
import type {
  CreateEmployeeInput,
  EmployeeListQueryInput,
  UpdateEmployeeInput,
} from "../validators/employee.validators.js"

const EMPLOYEE_POPULATE = [
  { path: "userId", select: "name email role isActive" },
  { path: "departmentId", select: "name code" },
  { path: "designationId", select: "title departmentId" },
  { path: "managerId", select: "firstName lastName employeeCode" },
] as const

function asId(value: unknown) {
  if (!value) {
    return null
  }

  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id: unknown })._id)
  }

  return String(value)
}

function asIso(value: Date | string | undefined) {
  if (!value) {
    return new Date().toISOString()
  }

  return value instanceof Date ? value.toISOString() : value
}

function asDateOnly(value: Date | string | null | undefined) {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toISOString().slice(0, 10)
}

function parseDateInput(value: string | null | undefined) {
  if (value === undefined) {
    return undefined
  }

  if (!value) {
    return null
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    throw AppError.badRequest("Enter a valid date")
  }

  return date
}

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

export function toPublicEmployee(doc: Record<string, unknown>) {
  const user =
    doc.userId && typeof doc.userId === "object" && "email" in doc.userId
      ? (doc.userId as {
          _id: unknown
          name: string
          email: string
          role: string
          isActive: boolean
        })
      : null
  const department =
    doc.departmentId && typeof doc.departmentId === "object" && "name" in doc.departmentId
      ? (doc.departmentId as { _id: unknown; name: string; code?: string })
      : null
  const designation =
    doc.designationId && typeof doc.designationId === "object" && "title" in doc.designationId
      ? (doc.designationId as { _id: unknown; title: string })
      : null
  const manager =
    doc.managerId && typeof doc.managerId === "object" && "firstName" in doc.managerId
      ? (doc.managerId as {
          _id: unknown
          firstName: string
          lastName: string
          employeeCode?: string
        })
      : null
  const address = (doc.address as Record<string, string> | undefined) ?? {}
  const emergency = (doc.emergencyContact as Record<string, string | null> | undefined) ?? {}

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId) ?? "",
    userId: asId(doc.userId) ?? "",
    employeeCode: String(doc.employeeCode),
    firstName: String(doc.firstName),
    lastName: String(doc.lastName),
    fullName: `${doc.firstName} ${doc.lastName}`.trim(),
    profileImage: typeof doc.profileImage === "string" ? doc.profileImage : "",
    phone: typeof doc.phone === "string" ? doc.phone : "",
    dateOfBirth: asDateOnly(doc.dateOfBirth as Date | string | null),
    gender: (doc.gender as string | null) ?? null,
    address: {
      line1: address.line1 ?? "",
      line2: address.line2 ?? "",
      city: address.city ?? "",
      state: address.state ?? "",
      postalCode: address.postalCode ?? "",
      country: address.country ?? "",
    },
    departmentId: asId(doc.departmentId),
    department: department
      ? { id: String(department._id), name: department.name, code: department.code ?? "" }
      : null,
    designationId: asId(doc.designationId),
    designation: designation ? { id: String(designation._id), title: designation.title } : null,
    managerId: asId(doc.managerId),
    manager: manager
      ? {
          id: String(manager._id),
          firstName: manager.firstName,
          lastName: manager.lastName,
          employeeCode: manager.employeeCode ?? "",
          fullName: `${manager.firstName} ${manager.lastName}`.trim(),
        }
      : null,
    joiningDate: asDateOnly(doc.joiningDate as Date | string | null),
    employmentType: String(doc.employmentType ?? "full_time"),
    employmentStatus: String(doc.employmentStatus ?? "active"),
    workLocation: String(doc.workLocation ?? "office"),
    emergencyContact: {
      name: emergency.name ?? "",
      relationship: emergency.relationship ?? null,
      phone: emergency.phone ?? "",
    },
    user: user
      ? {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: Boolean(user.isActive),
        }
      : null,
    createdAt: asIso(doc.createdAt as Date),
    updatedAt: asIso(doc.updatedAt as Date),
  }
}

async function loadEmployee(organizationId: string, id: string) {
  parseObjectId(id)
  const employee = await EmployeeModel.findOne({ _id: id, organizationId })
    .populate([...EMPLOYEE_POPULATE])
    .lean()

  if (!employee) {
    throw AppError.notFound("Employee not found")
  }

  return toPublicEmployee(employee)
}

async function viewerEmployeeId(auth: AuthContext) {
  const employee = await EmployeeModel.findOne({
    organizationId: auth.organizationId,
    userId: auth.userId,
  })
    .select("_id")
    .lean()

  return employee ? String(employee._id) : null
}

async function accessFilter(auth: AuthContext) {
  if (hasAnyPermission(auth.role, [PERMISSIONS.EMPLOYEES_READ, PERMISSIONS.EMPLOYEES_MANAGE])) {
    return { organizationId: auth.organizationId } as Record<string, unknown>
  }

  if (hasAnyPermission(auth.role, [PERMISSIONS.EMPLOYEES_READ_TEAM])) {
    const myId = await viewerEmployeeId(auth)
    return {
      organizationId: auth.organizationId,
      $or: myId ? [{ userId: auth.userId }, { managerId: myId }] : [{ userId: auth.userId }],
    } as Record<string, unknown>
  }

  if (hasAnyPermission(auth.role, [PERMISSIONS.EMPLOYEES_READ_SELF])) {
    return { organizationId: auth.organizationId, userId: auth.userId } as Record<string, unknown>
  }

  throw AppError.forbidden()
}

export async function employeeScopeFilter(auth: AuthContext) {
  return accessFilter(auth)
}

async function assertCanView(
  auth: AuthContext,
  employee: { userId: string; managerId: string | null }
) {
  if (hasAnyPermission(auth.role, [PERMISSIONS.EMPLOYEES_READ, PERMISSIONS.EMPLOYEES_MANAGE])) {
    return
  }

  if (employee.userId === auth.userId) {
    return
  }

  if (hasAnyPermission(auth.role, [PERMISSIONS.EMPLOYEES_READ_TEAM])) {
    const myId = await viewerEmployeeId(auth)
    if (myId && employee.managerId === myId) {
      return
    }
  }

  throw AppError.forbidden()
}

async function assertDepartment(organizationId: string, departmentId?: string | null) {
  if (!departmentId) {
    return null
  }

  parseObjectId(departmentId, "Invalid department")
  const department = await DepartmentModel.findOne({ _id: departmentId, organizationId }).select("_id")

  if (!department) {
    throw AppError.badRequest("Department was not found in this organization")
  }

  return departmentId
}

async function assertDesignation(
  organizationId: string,
  designationId: string | null | undefined,
  departmentId: string | null
) {
  if (!designationId) {
    return null
  }

  parseObjectId(designationId, "Invalid designation")
  const designation = await DesignationModel.findOne({
    _id: designationId,
    organizationId,
  }).select("departmentId")

  if (!designation) {
    throw AppError.badRequest("Designation was not found in this organization")
  }

  if (departmentId && String(designation.departmentId) !== departmentId) {
    throw AppError.badRequest("Designation must belong to the selected department")
  }

  return designationId
}

async function assertManager(organizationId: string, managerId?: string | null, employeeId?: string) {
  if (!managerId) {
    return null
  }

  parseObjectId(managerId, "Invalid manager")

  if (employeeId && managerId === employeeId) {
    throw AppError.badRequest("An employee cannot report to themselves")
  }

  const manager = await EmployeeModel.findOne({ _id: managerId, organizationId }).select("_id")

  if (!manager) {
    throw AppError.badRequest("Manager was not found in this organization")
  }

  return managerId
}

async function searchUserIds(organizationId: string, search?: string) {
  const term = search?.trim()
  if (!term) {
    return []
  }

  const regex = new RegExp(escapeRegex(term), "i")
  const users = await UserModel.find({ organizationId, email: regex }).select("_id").lean()
  return users.map((user) => user._id)
}

function withSearch(scope: Record<string, unknown>, search?: string, userIds: unknown[] = []) {
  const term = search?.trim()
  if (!term) {
    return scope
  }

  const regex = new RegExp(escapeRegex(term), "i")
  const searchClause = {
    $or: [
      { firstName: regex },
      { lastName: regex },
      { employeeCode: regex },
      { phone: regex },
      ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
    ],
  }
  const { $or: scopeOr, ...rest } = scope

  if (scopeOr) {
    return { ...rest, $and: [{ $or: scopeOr }, searchClause] }
  }

  return { ...rest, ...searchClause }
}

export async function listEmployees(auth: AuthContext, query: EmployeeListQueryInput) {
  const scope = await accessFilter(auth)
  const search = resolvedSearch(query)
  const userIds = await searchUserIds(auth.organizationId, search)
  const filter = withSearch(scope, search, userIds)

  if (query.departmentId) {
    filter.departmentId = query.departmentId
  }

  if (query.employmentStatus) {
    filter.employmentStatus = query.employmentStatus
  }

  const pagination = { page: query.page, limit: query.limit }
  const [items, total] = await Promise.all([
    EmployeeModel.find(filter)
      .populate([...EMPLOYEE_POPULATE])
      .sort(mongoSort(query, { firstName: 1, lastName: 1 }))
      .skip(paginationSkip(pagination))
      .limit(pagination.limit)
      .lean(),
    EmployeeModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicEmployee(item)),
    ...paginationMeta(total, pagination),
  }
}

export async function getEmployee(auth: AuthContext, id: string) {
  const employee = await loadEmployee(auth.organizationId, id)
  await assertCanView(auth, employee)
  return employee
}

export async function getMyEmployee(auth: AuthContext) {
  const employee = await EmployeeModel.findOne({
    organizationId: auth.organizationId,
    userId: auth.userId,
  })
    .populate([...EMPLOYEE_POPULATE])
    .lean()

  if (!employee) {
    throw AppError.notFound("No employee profile is linked to this account")
  }

  return toPublicEmployee(employee)
}

export async function createEmployee(auth: AuthContext, input: CreateEmployeeInput) {
  const email = input.email.toLowerCase()
  const existing = await UserModel.findOne({ email }).select("_id")

  if (existing) {
    throw AppError.conflict(MESSAGES.EMAIL_IN_USE)
  }

  const departmentId = await assertDepartment(auth.organizationId, input.departmentId)
  const designationId = await assertDesignation(auth.organizationId, input.designationId, departmentId)
  const managerId = await assertManager(auth.organizationId, input.managerId)
  const employeeCode = await generateEmployeeCode(auth.organizationId)
  const fullName = `${input.firstName} ${input.lastName}`.trim()
  const role = input.role ?? USER_ROLES.EMPLOYEE
  const employmentStatus = input.employmentStatus ?? "active"

  const user = await UserModel.create({
    organizationId: auth.organizationId,
    employeeId: employeeCode,
    name: fullName,
    email,
    password: input.password,
    role,
    isActive: employmentStatus === "active" || employmentStatus === "on_leave",
  })

  try {
    const employee = await EmployeeModel.create({
      organizationId: auth.organizationId,
      userId: user._id,
      employeeCode,
      firstName: input.firstName,
      lastName: input.lastName,
      profileImage: input.profileImage ?? "",
      phone: input.phone ?? "",
      dateOfBirth: parseDateInput(input.dateOfBirth) ?? null,
      gender: input.gender ?? null,
      address: input.address ?? {},
      departmentId,
      designationId,
      managerId,
      joiningDate: parseDateInput(input.joiningDate) ?? null,
      employmentType: input.employmentType ?? "full_time",
      employmentStatus,
      workLocation: input.workLocation ?? "office",
      emergencyContact: input.emergencyContact ?? {},
    })

    const created = await loadEmployee(auth.organizationId, employee.id)
    const year = Number(dateKeyInTimeZone(new Date(), "Asia/Kolkata").slice(0, 4))
    try {
      await ensureEmployeeLeaveBalances(auth.organizationId, employee.id, year)
    } catch {
      // Balances are created on first leave visit if this seed fails.
    }
    await recordActivity(auth.organizationId, {
      title: `${created.fullName} joined the team`,
      detail: created.department?.name
        ? `${created.employeeCode} · ${created.department.name}`
        : created.employeeCode,
      tone: "success",
    })
    return created
  } catch (error) {
    await UserModel.deleteOne({ _id: user._id })

    if (isDuplicateKey(error, "employeeCode")) {
      throw AppError.conflict(MESSAGES.EMPLOYEE_CODE_IN_USE)
    }

    throw error
  }
}

export async function updateEmployee(auth: AuthContext, id: string, input: UpdateEmployeeInput) {
  parseObjectId(id)
  const employee = await EmployeeModel.findOne({ _id: id, organizationId: auth.organizationId })

  if (!employee) {
    throw AppError.notFound("Employee not found")
  }

  const nextDepartmentId =
    input.departmentId !== undefined
      ? await assertDepartment(auth.organizationId, input.departmentId)
      : asId(employee.departmentId)
  const nextDesignationId =
    input.designationId !== undefined
      ? await assertDesignation(auth.organizationId, input.designationId, nextDepartmentId)
      : asId(employee.designationId)

  if (input.designationId === undefined && input.departmentId !== undefined && nextDesignationId) {
    await assertDesignation(auth.organizationId, nextDesignationId, nextDepartmentId)
  }

  if (input.firstName !== undefined) employee.firstName = input.firstName
  if (input.lastName !== undefined) employee.lastName = input.lastName
  if (input.profileImage !== undefined) employee.profileImage = input.profileImage ?? ""
  if (input.phone !== undefined) employee.phone = input.phone ?? ""
  if (input.dateOfBirth !== undefined) {
    employee.dateOfBirth = parseDateInput(input.dateOfBirth) ?? null
  }
  if (input.gender !== undefined) employee.set("gender", input.gender)
  if (input.address !== undefined) employee.set("address", input.address)
  if (input.departmentId !== undefined) employee.set("departmentId", nextDepartmentId)
  if (input.designationId !== undefined) employee.set("designationId", nextDesignationId)
  if (input.managerId !== undefined) {
    employee.set("managerId", await assertManager(auth.organizationId, input.managerId, id))
  }
  if (input.joiningDate !== undefined) {
    employee.joiningDate = parseDateInput(input.joiningDate) ?? null
  }
  if (input.employmentType !== undefined) employee.employmentType = input.employmentType
  if (input.employmentStatus !== undefined) employee.employmentStatus = input.employmentStatus
  if (input.workLocation !== undefined) employee.workLocation = input.workLocation
  if (input.emergencyContact !== undefined) {
    employee.set("emergencyContact", input.emergencyContact)
  }

  await employee.save()

  const userUpdates: Record<string, unknown> = {}
  if (input.firstName !== undefined || input.lastName !== undefined) {
    userUpdates.name = `${employee.firstName} ${employee.lastName}`.trim()
  }
  if (input.email !== undefined) {
    const email = input.email.toLowerCase()
    const taken = await UserModel.findOne({ email, _id: { $ne: employee.userId } }).select("_id")
    if (taken) {
      throw AppError.conflict(MESSAGES.EMAIL_IN_USE)
    }
    userUpdates.email = email
  }
  if (input.role !== undefined) {
    userUpdates.role = input.role
  }
  if (input.employmentStatus !== undefined) {
    userUpdates.isActive =
      input.employmentStatus === "active" || input.employmentStatus === "on_leave"
  }

  if (Object.keys(userUpdates).length > 0) {
    await UserModel.updateOne({ _id: employee.userId }, userUpdates)
  }

  return loadEmployee(auth.organizationId, id)
}

export async function activateEmployee(auth: AuthContext, id: string) {
  const employee = await updateEmployee(auth, id, { employmentStatus: "active" })
  await recordActivity(auth.organizationId, {
    title: `${employee.fullName} is active again`,
    detail: employee.employeeCode,
    tone: "success",
  })
  return employee
}

export async function deactivateEmployee(auth: AuthContext, id: string) {
  parseObjectId(id)
  const employee = await EmployeeModel.findOne({
    _id: id,
    organizationId: auth.organizationId,
  }).select("userId")

  if (!employee) {
    throw AppError.notFound("Employee not found")
  }

  if (String(employee.userId) === auth.userId) {
    throw AppError.badRequest(MESSAGES.CANNOT_DEACTIVATE_SELF)
  }

  const updated = await updateEmployee(auth, id, { employmentStatus: "inactive" })
  await recordActivity(auth.organizationId, {
    title: `${updated.fullName} was deactivated`,
    detail: updated.employeeCode,
    tone: "muted",
  })
  return updated
}
