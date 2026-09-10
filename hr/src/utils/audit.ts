import type { Request } from "express"

import type { AuditAction, AuditModule } from "../constants/audit.js"
import { AuditLogModel } from "../models/audit-log.model.js"
import type { AuthContext } from "../types/auth.js"

const SENSITIVE_KEY =
  /password|passwd|secret|token|refresh|authorization|cookie|otp|pin|hash|credential|api[_-]?key|private[_-]?key|session/i

export function clientIp(req: Pick<Request, "headers" | "ip" | "socket">) {
  const forwarded = req.headers["x-forwarded-for"]
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0]?.trim().slice(0, 64) ?? ""
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(",")[0]?.trim().slice(0, 64) ?? ""
  }
  return String(req.ip || req.socket?.remoteAddress || "").slice(0, 64)
}

export function sanitizeAuditPayload(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]"
  if (value === undefined) return null
  if (value === null) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "bigint") return value.toString()
  if (typeof value !== "object") {
    if (typeof value === "string" && value.length > 4000) return value.slice(0, 4000)
    return value
  }

  if (typeof value === "object" && value !== null && "_bsontype" in value) {
    return String(value)
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeAuditPayload(item, depth + 1))
  }

  const output: Record<string, unknown> = {}
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (key === "__v") continue
    if (SENSITIVE_KEY.test(key)) {
      output[key] = "[redacted]"
      continue
    }
    if (key === "_id") {
      output.id = String(nested)
      continue
    }
    output[key] = sanitizeAuditPayload(nested, depth + 1)
  }
  return output
}

export type RecordAuditInput = {
  module: AuditModule
  action: AuditAction
  recordId: string
  previousData?: unknown
  newData?: unknown
}

export async function recordAudit(auth: AuthContext, input: RecordAuditInput) {
  try {
    if (!auth.userId || !input.recordId) return
    await AuditLogModel.create({
      organizationId: auth.organizationId,
      userId: auth.userId,
      module: input.module,
      action: input.action,
      recordId: input.recordId,
      previousData: sanitizeAuditPayload(input.previousData ?? null),
      newData: sanitizeAuditPayload(input.newData ?? null),
      ipAddress: (auth.ipAddress ?? "").slice(0, 64),
    })
  } catch {
    // Audit is best-effort and must not fail the source action.
  }
}
