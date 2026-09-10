import { MESSAGES } from "../constants/messages.js"
import { DepartmentModel } from "../models/department.model.js"
import { DesignationModel } from "../models/designation.model.js"
import { OrganizationModel } from "../models/organization.model.js"
import { UserModel } from "../models/user.model.js"
import { AppError } from "../utils/app-error.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { mongoSort, resolvedSearch, searchFilter } from "../utils/search.js"
import type {
  CreateDepartmentInput,
  CreateDesignationInput,
  ListQueryInput,
  UpdateDepartmentInput,
  UpdateDesignationInput,
  UpdateOrganizationInput,
} from "../validators/organization.validators.js"

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

function toPerson(value: unknown) {
  if (!value || typeof value !== "object" || !("name" in value)) {
    return null
  }

  const person = value as { _id: unknown; name: string; email?: string }

  return {
    id: String(person._id),
    name: person.name,
    email: person.email ?? "",
  }
}

function toDepartmentRef(value: unknown) {
  if (!value || typeof value !== "object" || !("name" in value)) {
    return null
  }

  const department = value as { _id: unknown; name: string; code?: string }

  return {
    id: String(department._id),
    name: department.name,
    code: department.code ?? "",
  }
}

function isDuplicateKey(error: unknown, field: string) {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 11000) {
    return false
  }

  const key = "keyPattern" in error && error.keyPattern && typeof error.keyPattern === "object"
    ? error.keyPattern
    : null

  return Boolean(key && field in key)
}

export function toPublicOrganization(org: {
  id?: string
  _id?: unknown
  name: string
  slug: string
  logo?: string | null
  industry?: string | null
  companySize?: string | null
  email?: string | null
  phone?: string | null
  address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  } | null
  timezone?: string | null
  workingDays?: string[]
  workingHours?: { start?: string; end?: string } | null
  settings?: { dateFormat?: string; weekStartsOn?: string } | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: org.id ?? String(org._id),
    name: org.name,
    slug: org.slug,
    logo: org.logo || "",
    industry: org.industry || "",
    companySize: org.companySize || null,
    email: org.email || "",
    phone: org.phone || "",
    address: {
      line1: org.address?.line1 ?? "",
      line2: org.address?.line2 ?? "",
      city: org.address?.city ?? "",
      state: org.address?.state ?? "",
      postalCode: org.address?.postalCode ?? "",
      country: org.address?.country ?? "",
    },
    timezone: org.timezone || "Asia/Kolkata",
    workingDays: org.workingDays?.length ? org.workingDays : [],
    workingHours: {
      start: org.workingHours?.start ?? "09:00",
      end: org.workingHours?.end ?? "18:00",
    },
    settings: {
      dateFormat: org.settings?.dateFormat ?? "DD/MM/YYYY",
      weekStartsOn: org.settings?.weekStartsOn ?? "monday",
    },
    createdAt: asIso(org.createdAt),
    updatedAt: asIso(org.updatedAt),
  }
}

function toPublicDepartment(doc: Record<string, unknown>) {
  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId) ?? "",
    name: String(doc.name),
    code: String(doc.code),
    description: typeof doc.description === "string" ? doc.description : "",
    headId: asId(doc.headId),
    head: toPerson(doc.headId),
    isActive: Boolean(doc.isActive),
    createdAt: asIso(doc.createdAt as Date),
    updatedAt: asIso(doc.updatedAt as Date),
  }
}

function toPublicDesignation(doc: Record<string, unknown>) {
  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId) ?? "",
    title: String(doc.title),
    departmentId: asId(doc.departmentId) ?? "",
    department: toDepartmentRef(doc.departmentId),
    description: typeof doc.description === "string" ? doc.description : "",
    isActive: Boolean(doc.isActive),
    createdAt: asIso(doc.createdAt as Date),
    updatedAt: asIso(doc.updatedAt as Date),
  }
}

export async function getOrganization(organizationId: string) {
  const organization = await OrganizationModel.findById(organizationId)

  if (!organization) {
    throw AppError.notFound("Organization not found")
  }

  return toPublicOrganization(organization)
}

export async function updateOrganization(organizationId: string, input: UpdateOrganizationInput) {
  const organization = await OrganizationModel.findById(organizationId)

  if (!organization) {
    throw AppError.notFound("Organization not found")
  }

  if (input.name !== undefined) organization.name = input.name
  if (input.logo !== undefined) organization.logo = input.logo ?? ""
  if (input.industry !== undefined) organization.industry = input.industry ?? ""
  if (input.companySize !== undefined) organization.companySize = input.companySize
  if (input.email !== undefined) organization.email = input.email ?? ""
  if (input.phone !== undefined) organization.phone = input.phone ?? ""
  if (input.timezone !== undefined) organization.timezone = input.timezone ?? "Asia/Kolkata"
  if (input.workingDays !== undefined) organization.workingDays = input.workingDays
  if (input.workingHours !== undefined) organization.workingHours = input.workingHours
  if (input.address !== undefined) {
    organization.address = {
      line1: input.address.line1 ?? "",
      line2: input.address.line2 ?? "",
      city: input.address.city ?? "",
      state: input.address.state ?? "",
      postalCode: input.address.postalCode ?? "",
      country: input.address.country ?? "",
    }
  }
  if (input.settings !== undefined) {
    organization.settings = {
      dateFormat: input.settings.dateFormat ?? organization.settings?.dateFormat,
      weekStartsOn: input.settings.weekStartsOn ?? organization.settings?.weekStartsOn,
    }
  }

  await organization.save()
  return toPublicOrganization(organization)
}

export async function listMembers(organizationId: string) {
  const users = await UserModel.find({ organizationId, isActive: true })
    .select("name email role")
    .sort({ name: 1 })
    .limit(200)
    .lean()

  return users.map((user) => ({
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
  }))
}

async function assertHeadInOrganization(organizationId: string, headId?: string | null) {
  if (!headId) {
    return null
  }

  parseObjectId(headId, "Invalid department head")
  const user = await UserModel.findOne({ _id: headId, organizationId, isActive: true }).select("_id")

  if (!user) {
    throw AppError.badRequest("Department head must be an active member of this organization")
  }

  return headId
}

async function assertDepartmentInOrganization(organizationId: string, departmentId: string) {
  parseObjectId(departmentId, "Invalid department")
  const department = await DepartmentModel.findOne({ _id: departmentId, organizationId }).select("_id")

  if (!department) {
    throw AppError.badRequest("Department was not found in this organization")
  }

  return departmentId
}

export async function listDepartments(organizationId: string, query: ListQueryInput) {
  const filter: Record<string, unknown> = {
    organizationId,
    ...searchFilter(["name", "code", "description"], resolvedSearch(query)),
  }

  if (query.isActive === "true") filter.isActive = true
  if (query.isActive === "false") filter.isActive = false

  const pagination = { page: query.page, limit: query.limit }
  const [items, total] = await Promise.all([
    DepartmentModel.find(filter)
      .populate("headId", "name email")
      .sort(mongoSort(query, { name: 1 }))
      .skip(paginationSkip(pagination))
      .limit(pagination.limit)
      .lean(),
    DepartmentModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicDepartment(item)),
    ...paginationMeta(total, pagination),
  }
}

export async function getDepartment(organizationId: string, id: string) {
  parseObjectId(id)
  const department = await DepartmentModel.findOne({ _id: id, organizationId })
    .populate("headId", "name email")
    .lean()

  if (!department) {
    throw AppError.notFound("Department not found")
  }

  return toPublicDepartment(department)
}

export async function createDepartment(organizationId: string, input: CreateDepartmentInput) {
  const headId = await assertHeadInOrganization(organizationId, input.headId)

  try {
    const department = await DepartmentModel.create({
      organizationId,
      name: input.name,
      code: input.code.toUpperCase(),
      description: input.description ?? "",
      headId,
      isActive: input.isActive ?? true,
    })

    return getDepartment(organizationId, department.id)
  } catch (error) {
    if (isDuplicateKey(error, "code")) {
      throw AppError.conflict(MESSAGES.DEPARTMENT_CODE_IN_USE)
    }
    if (isDuplicateKey(error, "name")) {
      throw AppError.conflict(MESSAGES.DEPARTMENT_NAME_IN_USE)
    }
    throw error
  }
}

export async function updateDepartment(
  organizationId: string,
  id: string,
  input: UpdateDepartmentInput
) {
  parseObjectId(id)
  const department = await DepartmentModel.findOne({ _id: id, organizationId })

  if (!department) {
    throw AppError.notFound("Department not found")
  }

  if (input.name !== undefined) department.name = input.name
  if (input.code !== undefined) department.code = input.code.toUpperCase()
  if (input.description !== undefined) department.description = input.description ?? ""
  if (input.isActive !== undefined) department.isActive = input.isActive
  if (input.headId !== undefined) {
    department.set("headId", await assertHeadInOrganization(organizationId, input.headId))
  }

  try {
    await department.save()
  } catch (error) {
    if (isDuplicateKey(error, "code")) {
      throw AppError.conflict(MESSAGES.DEPARTMENT_CODE_IN_USE)
    }
    if (isDuplicateKey(error, "name")) {
      throw AppError.conflict(MESSAGES.DEPARTMENT_NAME_IN_USE)
    }
    throw error
  }

  return getDepartment(organizationId, id)
}

export async function deleteDepartment(organizationId: string, id: string) {
  parseObjectId(id)
  const department = await DepartmentModel.findOne({ _id: id, organizationId }).select("_id")

  if (!department) {
    throw AppError.notFound("Department not found")
  }

  const designationCount = await DesignationModel.countDocuments({
    organizationId,
    departmentId: id,
  })

  if (designationCount > 0) {
    throw AppError.conflict(MESSAGES.DEPARTMENT_HAS_DESIGNATIONS)
  }

  await DepartmentModel.deleteOne({ _id: id, organizationId })
}

export async function listDesignations(organizationId: string, query: ListQueryInput) {
  const filter: Record<string, unknown> = {
    organizationId,
    ...searchFilter(["title", "description"], resolvedSearch(query)),
  }

  if (query.isActive === "true") filter.isActive = true
  if (query.isActive === "false") filter.isActive = false
  if (query.departmentId) filter.departmentId = query.departmentId

  const pagination = { page: query.page, limit: query.limit }
  const [items, total] = await Promise.all([
    DesignationModel.find(filter)
      .populate("departmentId", "name code")
      .sort(mongoSort(query, { title: 1 }))
      .skip(paginationSkip(pagination))
      .limit(pagination.limit)
      .lean(),
    DesignationModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicDesignation(item)),
    ...paginationMeta(total, pagination),
  }
}

export async function getDesignation(organizationId: string, id: string) {
  parseObjectId(id)
  const designation = await DesignationModel.findOne({ _id: id, organizationId })
    .populate("departmentId", "name code")
    .lean()

  if (!designation) {
    throw AppError.notFound("Designation not found")
  }

  return toPublicDesignation(designation)
}

export async function createDesignation(organizationId: string, input: CreateDesignationInput) {
  await assertDepartmentInOrganization(organizationId, input.departmentId)

  try {
    const designation = await DesignationModel.create({
      organizationId,
      title: input.title,
      departmentId: input.departmentId,
      description: input.description ?? "",
      isActive: input.isActive ?? true,
    })

    return getDesignation(organizationId, designation.id)
  } catch (error) {
    if (isDuplicateKey(error, "title")) {
      throw AppError.conflict(MESSAGES.DESIGNATION_IN_USE)
    }
    throw error
  }
}

export async function updateDesignation(
  organizationId: string,
  id: string,
  input: UpdateDesignationInput
) {
  parseObjectId(id)
  const designation = await DesignationModel.findOne({ _id: id, organizationId })

  if (!designation) {
    throw AppError.notFound("Designation not found")
  }

  if (input.title !== undefined) designation.title = input.title
  if (input.description !== undefined) designation.description = input.description ?? ""
  if (input.isActive !== undefined) designation.isActive = input.isActive
  if (input.departmentId !== undefined) {
    designation.set(
      "departmentId",
      await assertDepartmentInOrganization(organizationId, input.departmentId)
    )
  }

  try {
    await designation.save()
  } catch (error) {
    if (isDuplicateKey(error, "title")) {
      throw AppError.conflict(MESSAGES.DESIGNATION_IN_USE)
    }
    throw error
  }

  return getDesignation(organizationId, id)
}

export async function deleteDesignation(organizationId: string, id: string) {
  parseObjectId(id)
  const result = await DesignationModel.deleteOne({ _id: id, organizationId })

  if (result.deletedCount === 0) {
    throw AppError.notFound("Designation not found")
  }
}
