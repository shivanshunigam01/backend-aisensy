import mongoose from "mongoose"

import { env } from "../config/env.js"
import {
  DOCUMENT_EXPIRING_DAYS,
  type DocumentStatus,
  type DocumentType,
} from "../constants/documents.js"
import { MESSAGES } from "../constants/messages.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { DocumentModel } from "../models/document.model.js"
import { EmployeeModel } from "../models/employee.model.js"
import { OrganizationModel } from "../models/organization.model.js"
import type { AuthContext } from "../types/auth.js"
import { hasAnyPermission } from "../utils/access.js"
import { recordActivity } from "../utils/activity.js"
import { notifyDocumentExpiry, notifyExpiringDocuments } from "../notifications/index.js"
import { AppError } from "../utils/app-error.js"
import {
  destroyDocumentFile,
  signedDocumentUrl,
  uploadDocumentFile,
} from "../utils/cloudinary.js"
import {
  addUtcDays,
  dateKeyFromDate,
  dateKeyInTimeZone,
  formatShortDate,
  initialsFromName,
  utcDateFromKey,
} from "../utils/dates.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { escapeRegex, mongoSort, resolvedSearch } from "../utils/search.js"
import type {
  DocumentListQueryInput,
  UpdateDocumentInput,
  UploadDocumentInput,
} from "../validators/document.validators.js"

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

const DOCUMENT_POPULATE = {
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

function resolveStatus(expiryDate: Date | null | undefined, todayKey: string): DocumentStatus {
  if (!expiryDate) {
    return "active"
  }

  const expiryKey = dateKeyFromDate(expiryDate)
  if (expiryKey < todayKey) {
    return "expired"
  }

  const soonKey = dateKeyFromDate(addUtcDays(utcDateFromKey(todayKey), DOCUMENT_EXPIRING_DAYS))
  if (expiryKey <= soonKey) {
    return "expiring"
  }

  return "active"
}

function statusFilter(status: DocumentStatus, today: Date) {
  const soon = addUtcDays(today, DOCUMENT_EXPIRING_DAYS)

  if (status === "expired") {
    return { expiryDate: { $ne: null, $lt: today } }
  }

  if (status === "expiring") {
    return { expiryDate: { $gte: today, $lte: soon } }
  }

  return {
    $or: [{ expiryDate: null }, { expiryDate: { $gt: soon } }],
  }
}

async function todayKeyForOrg(organizationId: string) {
  const organization = await OrganizationModel.findById(organizationId).select("timezone").lean()
  const timezone = organization?.timezone || DEFAULT_TIMEZONE
  return { timezone, todayKey: dateKeyInTimeZone(new Date(), timezone) }
}

function toPublicDocument(doc: Record<string, unknown>, todayKey: string, timezone: string) {
  const employee =
    doc.employeeId && typeof doc.employeeId === "object" && "firstName" in doc.employeeId
      ? toEmployeeCard(doc.employeeId as EmployeeCard)
      : null
  const expiryDate =
    doc.expiryDate instanceof Date ? dateKeyFromDate(doc.expiryDate) : doc.expiryDate
      ? dateKeyFromDate(new Date(String(doc.expiryDate)))
      : null
  const uploadedAt =
    doc.uploadedAt instanceof Date
      ? doc.uploadedAt.toISOString()
      : String(doc.uploadedAt ?? doc.createdAt ?? "")
  const status = resolveStatus(
    expiryDate ? utcDateFromKey(expiryDate) : null,
    todayKey
  )

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    employeeId: employee?.id ?? asId(doc.employeeId),
    employee,
    name: String(doc.name),
    type: String(doc.type) as DocumentType,
    fileSize: Number(doc.fileSize),
    mimeType: String(doc.mimeType ?? ""),
    expiryDate,
    expiryLabel: expiryDate ? formatShortDate(expiryDate) : null,
    status,
    uploadedAt,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt ?? ""),
    timezone,
  }
}

async function documentEmployeeFilter(auth: AuthContext) {
  if (hasAnyPermission(auth.role, [PERMISSIONS.DOCUMENTS_READ, PERMISSIONS.DOCUMENTS_MANAGE])) {
    return { organizationId: auth.organizationId } as Record<string, unknown>
  }

  if (hasAnyPermission(auth.role, [PERMISSIONS.DOCUMENTS_READ_SELF])) {
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
  const filter = await documentEmployeeFilter(auth)
  const employee = await EmployeeModel.findOne({ ...filter, _id: employeeId }).lean<EmployeeCard>()
  if (!employee) {
    throw AppError.forbidden()
  }
  return employee
}

function canWriteOwn(auth: AuthContext) {
  return hasAnyPermission(auth.role, [PERMISSIONS.DOCUMENTS_READ_SELF, PERMISSIONS.DOCUMENTS_MANAGE])
}

function canWriteAny(auth: AuthContext) {
  return hasAnyPermission(auth.role, [PERMISSIONS.DOCUMENTS_MANAGE])
}

async function resolveTargetEmployee(auth: AuthContext, employeeId?: string) {
  if (employeeId) {
    if (!canWriteAny(auth)) {
      const mine = await requireMyEmployee(auth)
      if (String(mine._id) !== employeeId) {
        throw AppError.forbidden()
      }
      return mine
    }

    const employee = await EmployeeModel.findOne({
      organizationId: auth.organizationId,
      _id: employeeId,
    }).lean<EmployeeCard>()

    if (!employee) {
      throw AppError.notFound("Employee not found")
    }

    return employee
  }

  return requireMyEmployee(auth)
}

export async function listDocuments(auth: AuthContext, query: DocumentListQueryInput) {
  const { timezone, todayKey } = await todayKeyForOrg(auth.organizationId)
  const today = utcDateFromKey(todayKey)
  const filter = await documentEmployeeFilter(auth)
  const employees = await EmployeeModel.find(filter).select("_id").lean()
  let employeeIds = employees.map((row) => row._id)

  if (query.employeeId) {
    await assertEmployeeInScope(auth, query.employeeId)
    employeeIds = employeeIds.filter((id) => String(id) === query.employeeId)
  }

  const documentFilter: Record<string, unknown> = {
    organizationId: auth.organizationId,
    employeeId: { $in: employeeIds },
  }

  if (query.type) documentFilter.type = query.type
  if (query.status) Object.assign(documentFilter, statusFilter(query.status, today))
  const documentSearch = resolvedSearch(query)
  if (documentSearch) {
    documentFilter.name = new RegExp(escapeRegex(documentSearch), "i")
  }

  const pagination = { page: query.page, limit: query.limit }
  const orgMatch = {
    organizationId: new mongoose.Types.ObjectId(auth.organizationId),
    employeeId: { $in: employeeIds },
  }
  const soon = addUtcDays(today, DOCUMENT_EXPIRING_DAYS)

  const [items, total, expiredCount, expiringCount] = await Promise.all([
    DocumentModel.find(documentFilter)
      .populate(DOCUMENT_POPULATE)
      .sort(mongoSort(query, { uploadedAt: -1 }))
      .skip(paginationSkip(pagination))
      .limit(pagination.limit)
      .lean(),
    DocumentModel.countDocuments(documentFilter),
    DocumentModel.countDocuments({ ...orgMatch, expiryDate: { $ne: null, $lt: today } }),
    DocumentModel.countDocuments({
      ...orgMatch,
      expiryDate: { $gte: today, $lte: soon },
    }),
  ])

  const allCount = await DocumentModel.countDocuments(orgMatch)

  void notifyExpiringDocuments(auth.organizationId)

  return {
    timezone,
    today: todayKey,
    items: items.map((item) => toPublicDocument(item as Record<string, unknown>, todayKey, timezone)),
    summary: {
      total: allCount,
      expiring: expiringCount,
      expired: expiredCount,
      active: Math.max(0, allCount - expiringCount - expiredCount),
    },
    ...paginationMeta(total, pagination),
  }
}

export async function getDocument(auth: AuthContext, id: string) {
  parseObjectId(id)
  const { timezone, todayKey } = await todayKeyForOrg(auth.organizationId)
  const document = await DocumentModel.findOne({
    _id: id,
    organizationId: auth.organizationId,
  })
    .populate(DOCUMENT_POPULATE)
    .lean()

  if (!document) {
    throw AppError.notFound("Document not found")
  }

  await assertEmployeeInScope(auth, asId(document.employeeId))
  return toPublicDocument(document as Record<string, unknown>, todayKey, timezone)
}

export async function getDocumentFile(auth: AuthContext, id: string) {
  parseObjectId(id)
  const document = await DocumentModel.findOne({
    _id: id,
    organizationId: auth.organizationId,
  }).populate({ path: "employeeId", select: "userId" })

  if (!document) {
    throw AppError.notFound("Document not found")
  }

  await assertEmployeeInScope(auth, asId(document.employeeId))
  return signedDocumentUrl(document.publicId, document.resourceType || "raw")
}

export async function uploadDocument(
  auth: AuthContext,
  input: UploadDocumentInput,
  file?: Express.Multer.File
) {
  if (!canWriteOwn(auth)) {
    throw AppError.forbidden()
  }

  if (!file) {
    throw AppError.badRequest(MESSAGES.DOCUMENT_FILE_REQUIRED)
  }

  const employee = await resolveTargetEmployee(auth, input.employeeId)
  const { timezone, todayKey } = await todayKeyForOrg(auth.organizationId)
  const expiryDate = input.expiryDate ? utcDateFromKey(input.expiryDate) : null
  const status = resolveStatus(expiryDate, todayKey)
  const name = input.name || file.originalname.replace(/\.[^.]+$/, "") || "Document"

  let uploaded
  try {
    uploaded = await uploadDocumentFile({
      buffer: file.buffer,
      folder: `${env.CLOUDINARY_FOLDER}/${auth.organizationId}`,
      filename: file.originalname,
      mimeType: file.mimetype,
    })
  } catch {
    throw AppError.internal("Unable to store this file")
  }

  const created = await DocumentModel.create({
    organizationId: auth.organizationId,
    employeeId: employee._id,
    name,
    type: input.type,
    fileUrl: uploaded.fileUrl,
    publicId: uploaded.publicId,
    resourceType: uploaded.resourceType,
    mimeType: file.mimetype,
    fileSize: file.size || uploaded.bytes,
    expiryDate,
    status,
    uploadedAt: new Date(),
  })

  await recordActivity(auth.organizationId, {
    title: "Document uploaded",
    detail: `${name} · ${employeeName(employee)}`,
    tone: "brand",
  })

  if (status === "expiring" || status === "expired") {
    await notifyDocumentExpiry({
      organizationId: auth.organizationId,
      employeeUserId: employee.userId,
      documentId: String(created._id),
      name,
      expiryLabel: input.expiryDate ?? "",
      expired: status === "expired",
    })
  }

  const populated = await DocumentModel.findById(created._id).populate(DOCUMENT_POPULATE).lean()
  return toPublicDocument(populated as Record<string, unknown>, todayKey, timezone)
}

export async function updateDocument(auth: AuthContext, id: string, input: UpdateDocumentInput) {
  parseObjectId(id)
  const { timezone, todayKey } = await todayKeyForOrg(auth.organizationId)
  const document = await DocumentModel.findOne({
    _id: id,
    organizationId: auth.organizationId,
  }).populate({ path: "employeeId", select: "userId firstName lastName" })

  if (!document) {
    throw AppError.notFound("Document not found")
  }

  const employee = document.employeeId as unknown as EmployeeCard
  const isOwn = asId(employee.userId) === auth.userId
  if (!isOwn && !canWriteAny(auth)) {
    throw AppError.forbidden()
  }

  if (input.name !== undefined) document.name = input.name
  if (input.type !== undefined) document.type = input.type
  if (input.expiryDate !== undefined) {
    document.expiryDate = input.expiryDate ? utcDateFromKey(input.expiryDate) : null
  }
  document.status = resolveStatus(document.expiryDate, todayKey)
  await document.save()

  if (document.status === "expiring" || document.status === "expired") {
    const expiryLabel =
      document.expiryDate instanceof Date ? dateKeyFromDate(document.expiryDate) : ""
    await notifyDocumentExpiry({
      organizationId: auth.organizationId,
      employeeUserId: employee.userId,
      documentId: String(document._id),
      name: document.name,
      expiryLabel,
      expired: document.status === "expired",
    })
  }

  const populated = await DocumentModel.findById(document._id).populate(DOCUMENT_POPULATE).lean()
  return toPublicDocument(populated as Record<string, unknown>, todayKey, timezone)
}

export async function deleteDocument(auth: AuthContext, id: string) {
  parseObjectId(id)
  const document = await DocumentModel.findOne({
    _id: id,
    organizationId: auth.organizationId,
  }).populate({ path: "employeeId", select: "userId firstName lastName" })

  if (!document) {
    throw AppError.notFound("Document not found")
  }

  const employee = document.employeeId as unknown as EmployeeCard
  const isOwn = asId(employee.userId) === auth.userId
  if (!isOwn && !canWriteAny(auth)) {
    throw AppError.forbidden()
  }

  await destroyDocumentFile(document.publicId, document.resourceType || "raw")
  await document.deleteOne()

  await recordActivity(auth.organizationId, {
    title: "Document removed",
    detail: document.name,
    tone: "muted",
  })
}
