import {
  AUDIT_ACTION_LABELS,
  AUDIT_MODULE_LABELS,
  type AuditAction,
  type AuditModule,
} from "../constants/audit.js"
import { MESSAGES } from "../constants/messages.js"
import { AuditLogModel } from "../models/audit-log.model.js"
import type { AuthContext } from "../types/auth.js"
import { AppError } from "../utils/app-error.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { applySearch, mongoSort, resolvedSearch } from "../utils/search.js"
import type { AuditListQueryInput } from "../validators/audit.validators.js"

const AUDIT_POPULATE = [{ path: "userId", select: "name email role" }] as const

function asId(value: unknown) {
  if (!value) return ""
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id: unknown })._id)
  }
  return String(value)
}

function isoOf(value: unknown) {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string" && value) return new Date(value).toISOString()
  return ""
}

function toUserRef(value: unknown) {
  if (!value) return null
  if (typeof value === "object" && value !== null && ("name" in value || "email" in value)) {
    const user = value as { _id: unknown; name?: string; email?: string; role?: string }
    return {
      id: String(user._id),
      name: user.name ?? "",
      email: user.email ?? "",
      role: user.role ?? "",
    }
  }
  return { id: String(value), name: "", email: "", role: "" }
}

export function toPublicAuditLog(doc: Record<string, unknown>) {
  const user = toUserRef(doc.userId)
  const module = (String(doc.module ?? "") as AuditModule) || "CLIENTS"
  const action = (String(doc.action ?? "") as AuditAction) || "UPDATED"

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    userId: user?.id ?? asId(doc.userId),
    user,
    module,
    moduleLabel: AUDIT_MODULE_LABELS[module] ?? module,
    action,
    actionLabel: AUDIT_ACTION_LABELS[action] ?? action,
    recordId: asId(doc.recordId),
    previousData: doc.previousData ?? null,
    newData: doc.newData ?? null,
    ipAddress: String(doc.ipAddress ?? ""),
    createdAt: isoOf(doc.createdAt),
  }
}

export async function listAuditLogs(auth: AuthContext, query: AuditListQueryInput) {
  const filter: Record<string, unknown> = { organizationId: auth.organizationId }

  if (query.module) filter.module = query.module
  if (query.action) filter.action = query.action
  if (query.userId) {
    parseObjectId(query.userId, "Invalid user")
    filter.userId = query.userId
  }
  if (query.recordId) {
    parseObjectId(query.recordId, "Invalid record")
    filter.recordId = query.recordId
  }

  applySearch(filter, ["ipAddress"], resolvedSearch(query))

  const [items, total] = await Promise.all([
    AuditLogModel.find(filter)
      .populate([...AUDIT_POPULATE])
      .sort(mongoSort(query, { createdAt: -1 }))
      .skip(paginationSkip(query))
      .limit(query.limit)
      .lean(),
    AuditLogModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicAuditLog(item as Record<string, unknown>)),
    ...paginationMeta(total, query),
  }
}

export async function getAuditLog(auth: AuthContext, id: string) {
  parseObjectId(id)
  const log = await AuditLogModel.findOne({ _id: id, organizationId: auth.organizationId }).populate([
    ...AUDIT_POPULATE,
  ])
  if (!log) {
    throw AppError.notFound(MESSAGES.AUDIT_NOT_FOUND)
  }
  return toPublicAuditLog(log.toObject() as Record<string, unknown>)
}
