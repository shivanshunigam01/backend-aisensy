import mongoose from "mongoose"

import { MESSAGES } from "../constants/messages.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { AssetAssignmentModel } from "../models/asset-assignment.model.js"
import { AssetModel } from "../models/asset.model.js"
import { EmployeeModel } from "../models/employee.model.js"
import type { AuthContext } from "../types/auth.js"
import { hasAnyPermission } from "../utils/access.js"
import { recordActivity } from "../utils/activity.js"
import { AppError } from "../utils/app-error.js"
import { generateAssetCode } from "../utils/asset-code.js"
import {
  dateKeyFromDate,
  dateKeyInTimeZone,
  formatShortDate,
  initialsFromName,
  utcDateFromKey,
} from "../utils/dates.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { applySearch, mongoSort, resolvedSearch } from "../utils/search.js"
import type {
  AssetListQueryInput,
  AssignAssetInput,
  CreateAssetInput,
  ReturnAssetInput,
  UpdateAssetInput,
} from "../validators/asset.validators.js"

const DEFAULT_TIMEZONE = "Asia/Kolkata"

type EmployeeCard = {
  _id: mongoose.Types.ObjectId
  firstName: string
  lastName: string
  profileImage?: string
  employeeCode?: string
  userId?: mongoose.Types.ObjectId
  departmentId?: { name?: string } | mongoose.Types.ObjectId | null
}

const EMPLOYEE_POPULATE = {
  path: "employeeId",
  select: "firstName lastName profileImage employeeCode userId departmentId",
  populate: { path: "departmentId", select: "name" },
} as const

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

function canReadAll(auth: AuthContext) {
  return hasAnyPermission(auth.role, [PERMISSIONS.ASSETS_READ, PERMISSIONS.ASSETS_MANAGE])
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

function todayKey() {
  return dateKeyInTimeZone(new Date(), DEFAULT_TIMEZONE)
}

function toPublicAssignment(doc: Record<string, unknown>) {
  const employee =
    doc.employeeId && typeof doc.employeeId === "object" && "firstName" in doc.employeeId
      ? toEmployeeCard(doc.employeeId as EmployeeCard)
      : null
  const assigner =
    doc.assignedBy && typeof doc.assignedBy === "object" && "name" in doc.assignedBy
      ? (doc.assignedBy as { _id: unknown; name: string })
      : null
  const assignedDate =
    doc.assignedDate instanceof Date ? dateKeyFromDate(doc.assignedDate) : String(doc.assignedDate ?? "")
  const returnedDate =
    doc.returnedDate instanceof Date
      ? dateKeyFromDate(doc.returnedDate)
      : doc.returnedDate
        ? dateKeyFromDate(new Date(String(doc.returnedDate)))
        : null

  return {
    id: String(doc._id ?? doc.id),
    assetId: asId(doc.assetId),
    employeeId: employee?.id ?? asId(doc.employeeId),
    employee,
    assignedDate,
    assignedLabel: assignedDate ? formatShortDate(assignedDate) : "",
    returnedDate,
    returnedLabel: returnedDate ? formatShortDate(returnedDate) : null,
    assignedBy: assigner ? { id: String(assigner._id), name: assigner.name } : null,
    status: String(doc.status),
    notes: String(doc.notes ?? ""),
  }
}

function toPublicAsset(
  doc: Record<string, unknown>,
  assignment?: Record<string, unknown> | null
) {
  const purchaseDate =
    doc.purchaseDate instanceof Date
      ? dateKeyFromDate(doc.purchaseDate)
      : doc.purchaseDate
        ? dateKeyFromDate(new Date(String(doc.purchaseDate)))
        : null

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    name: String(doc.name),
    assetCode: String(doc.assetCode),
    category: String(doc.category),
    serialNumber: String(doc.serialNumber ?? ""),
    purchaseDate,
    purchaseLabel: purchaseDate ? formatShortDate(purchaseDate) : null,
    condition: String(doc.condition),
    status: String(doc.status),
    currentAssignment: assignment ? toPublicAssignment(assignment) : null,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt ?? ""),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt ?? ""),
  }
}

async function loadCurrentAssignments(assetIds: mongoose.Types.ObjectId[]) {
  if (assetIds.length === 0) {
    return new Map<string, Record<string, unknown>>()
  }

  const rows = await AssetAssignmentModel.find({
    assetId: { $in: assetIds },
    status: "active",
  })
    .populate(EMPLOYEE_POPULATE)
    .populate({ path: "assignedBy", select: "name" })
    .lean()

  return new Map(rows.map((row) => [String(row.assetId), row as Record<string, unknown>]))
}

async function assertCanViewAsset(auth: AuthContext, assetId: string) {
  if (canReadAll(auth)) {
    return
  }

  const mine = await requireMyEmployee(auth)
  const assignment = await AssetAssignmentModel.findOne({
    organizationId: auth.organizationId,
    assetId,
    employeeId: mine._id,
  }).select("_id")

  if (!assignment) {
    throw AppError.forbidden()
  }
}

export async function listAssets(auth: AuthContext, query: AssetListQueryInput) {
  const filter: Record<string, unknown> = { organizationId: auth.organizationId }

  if (query.category) filter.category = query.category
  if (query.status) filter.status = query.status
  if (query.condition) filter.condition = query.condition
  applySearch(filter, ["name", "assetCode", "serialNumber"], resolvedSearch(query))

  if (!canReadAll(auth)) {
    const mine = await requireMyEmployee(auth)
    if (query.employeeId && query.employeeId !== String(mine._id)) {
      throw AppError.forbidden()
    }
    const mineAssignments = await AssetAssignmentModel.find({
      organizationId: auth.organizationId,
      employeeId: mine._id,
      status: "active",
    })
      .select("assetId")
      .lean()
    filter._id = { $in: mineAssignments.map((row) => row.assetId) }
  } else if (query.employeeId) {
    parseObjectId(query.employeeId)
    const assigned = await AssetAssignmentModel.find({
      organizationId: auth.organizationId,
      employeeId: query.employeeId,
      status: "active",
    })
      .select("assetId")
      .lean()
    filter._id = { $in: assigned.map((row) => row.assetId) }
  }

  const pagination = { page: query.page, limit: query.limit }
  const summaryMatch = { organizationId: new mongoose.Types.ObjectId(auth.organizationId) }

  const [items, total, buckets] = await Promise.all([
    AssetModel.find(filter)
      .sort(mongoSort(query, { createdAt: -1 }))
      .skip(paginationSkip(pagination))
      .limit(pagination.limit)
      .lean(),
    AssetModel.countDocuments(filter),
    canReadAll(auth)
      ? AssetModel.aggregate<{ _id: string; count: number }>([
          { $match: summaryMatch },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
  ])

  const assignmentMap = await loadCurrentAssignments(items.map((item) => item._id))
  const counts = Object.fromEntries(buckets.map((row) => [row._id, row.count]))

  return {
    items: items.map((item) =>
      toPublicAsset(item as Record<string, unknown>, assignmentMap.get(String(item._id)) ?? null)
    ),
    summary: {
      total: canReadAll(auth) ? buckets.reduce((sum, row) => sum + row.count, 0) : total,
      available: counts.available ?? 0,
      assigned: counts.assigned ?? 0,
      maintenance: counts.maintenance ?? 0,
      retired: counts.retired ?? 0,
    },
    scoped: !canReadAll(auth),
    ...paginationMeta(total, pagination),
  }
}

export async function getAsset(auth: AuthContext, id: string) {
  parseObjectId(id)
  const asset = await AssetModel.findOne({ _id: id, organizationId: auth.organizationId }).lean()
  if (!asset) {
    throw AppError.notFound("Asset not found")
  }

  await assertCanViewAsset(auth, id)
  const assignments = await loadCurrentAssignments([asset._id])
  return toPublicAsset(asset as Record<string, unknown>, assignments.get(id) ?? null)
}

export async function createAsset(auth: AuthContext, input: CreateAssetInput) {
  const assetCode = input.assetCode?.toUpperCase() || (await generateAssetCode(auth.organizationId))

  try {
    const created = await AssetModel.create({
      organizationId: auth.organizationId,
      name: input.name,
      assetCode,
      category: input.category,
      serialNumber: input.serialNumber ?? "",
      purchaseDate: input.purchaseDate ? utcDateFromKey(input.purchaseDate) : null,
      condition: input.condition ?? "good",
      status: input.status ?? "available",
    })

    await recordActivity(auth.organizationId, {
      title: "Asset added",
      detail: `${created.name} · ${created.assetCode}`,
      tone: "success",
    })

    return toPublicAsset(created.toObject(), null)
  } catch (error) {
    if (isDuplicateKey(error, "assetCode")) {
      throw AppError.conflict(MESSAGES.ASSET_CODE_IN_USE)
    }
    if (isDuplicateKey(error, "serialNumber")) {
      throw AppError.conflict(MESSAGES.ASSET_SERIAL_IN_USE)
    }
    throw error
  }
}

export async function updateAsset(auth: AuthContext, id: string, input: UpdateAssetInput) {
  parseObjectId(id)
  const asset = await AssetModel.findOne({ _id: id, organizationId: auth.organizationId })
  if (!asset) {
    throw AppError.notFound("Asset not found")
  }

  if (input.status && input.status !== asset.status) {
    if (asset.status === "assigned") {
      throw AppError.badRequest(MESSAGES.ASSET_RETURN_FIRST)
    }
    if (input.status === "assigned") {
      throw AppError.badRequest(MESSAGES.ASSET_ASSIGN_REQUIRED)
    }
  }

  if (input.name !== undefined) asset.name = input.name
  if (input.assetCode !== undefined) asset.assetCode = input.assetCode.toUpperCase()
  if (input.category !== undefined) asset.category = input.category
  if (input.serialNumber !== undefined) asset.serialNumber = input.serialNumber
  if (input.purchaseDate !== undefined) {
    asset.purchaseDate = input.purchaseDate ? utcDateFromKey(input.purchaseDate) : null
  }
  if (input.condition !== undefined) asset.condition = input.condition
  if (input.status !== undefined) asset.status = input.status

  try {
    await asset.save()
  } catch (error) {
    if (isDuplicateKey(error, "assetCode")) {
      throw AppError.conflict(MESSAGES.ASSET_CODE_IN_USE)
    }
    if (isDuplicateKey(error, "serialNumber")) {
      throw AppError.conflict(MESSAGES.ASSET_SERIAL_IN_USE)
    }
    throw error
  }

  const assignments = await loadCurrentAssignments([asset._id])
  return toPublicAsset(asset.toObject(), assignments.get(id) ?? null)
}

export async function deleteAsset(auth: AuthContext, id: string) {
  parseObjectId(id)
  const asset = await AssetModel.findOne({ _id: id, organizationId: auth.organizationId })
  if (!asset) {
    throw AppError.notFound("Asset not found")
  }

  if (asset.status === "assigned") {
    throw AppError.badRequest(MESSAGES.ASSET_RETURN_FIRST)
  }

  await AssetAssignmentModel.deleteMany({ organizationId: auth.organizationId, assetId: asset._id })
  await asset.deleteOne()
}

export async function assignAsset(auth: AuthContext, id: string, input: AssignAssetInput) {
  parseObjectId(id)
  const asset = await AssetModel.findOne({ _id: id, organizationId: auth.organizationId })
  if (!asset) {
    throw AppError.notFound("Asset not found")
  }

  if (asset.status !== "available") {
    throw AppError.badRequest(MESSAGES.ASSET_NOT_AVAILABLE)
  }

  const employee = await EmployeeModel.findOne({
    _id: input.employeeId,
    organizationId: auth.organizationId,
  }).lean<EmployeeCard>()

  if (!employee) {
    throw AppError.notFound("Employee not found")
  }

  const assignedDate = utcDateFromKey(input.assignedDate || todayKey())

  try {
    await AssetAssignmentModel.create({
      organizationId: auth.organizationId,
      assetId: asset._id,
      employeeId: employee._id,
      assignedDate,
      assignedBy: auth.userId,
      status: "active",
      notes: input.notes ?? "",
    })
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw AppError.conflict(MESSAGES.ASSET_NOT_AVAILABLE)
    }
    throw error
  }

  asset.status = "assigned"
  await asset.save()

  await recordActivity(auth.organizationId, {
    title: "Asset assigned",
    detail: `${asset.name} · ${employeeName(employee)}`,
    tone: "brand",
  })

  const assignments = await loadCurrentAssignments([asset._id])
  return toPublicAsset(asset.toObject(), assignments.get(id) ?? null)
}

export async function returnAsset(auth: AuthContext, id: string, input: ReturnAssetInput) {
  parseObjectId(id)
  const asset = await AssetModel.findOne({ _id: id, organizationId: auth.organizationId })
  if (!asset) {
    throw AppError.notFound("Asset not found")
  }

  const assignment = await AssetAssignmentModel.findOne({
    organizationId: auth.organizationId,
    assetId: asset._id,
    status: "active",
  })

  if (!assignment || asset.status !== "assigned") {
    throw AppError.badRequest(MESSAGES.ASSET_NOT_ASSIGNED)
  }

  assignment.status = "returned"
  assignment.returnedDate = utcDateFromKey(input.returnedDate || todayKey())
  if (input.notes) {
    assignment.notes = assignment.notes
      ? `${assignment.notes}\nReturn: ${input.notes}`
      : input.notes
  }
  await assignment.save()

  if (input.condition) asset.condition = input.condition
  asset.status = input.nextStatus ?? "available"
  await asset.save()

  await recordActivity(auth.organizationId, {
    title: "Asset returned",
    detail: `${asset.name} · ${asset.assetCode}`,
    tone: "muted",
  })

  return toPublicAsset(asset.toObject(), null)
}

export async function listAssetHistory(auth: AuthContext, id: string) {
  parseObjectId(id)
  const asset = await AssetModel.findOne({ _id: id, organizationId: auth.organizationId }).lean()
  if (!asset) {
    throw AppError.notFound("Asset not found")
  }

  await assertCanViewAsset(auth, id)

  const items = await AssetAssignmentModel.find({
    organizationId: auth.organizationId,
    assetId: asset._id,
  })
    .populate(EMPLOYEE_POPULATE)
    .populate({ path: "assignedBy", select: "name" })
    .sort({ assignedDate: -1 })
    .lean()

  return {
    asset: toPublicAsset(asset as Record<string, unknown>, items.find((row) => row.status === "active") ?? null),
    items: items.map((item) => toPublicAssignment(item as Record<string, unknown>)),
  }
}
