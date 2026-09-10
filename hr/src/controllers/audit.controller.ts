import type { Request, Response } from "express"

import * as auditService from "../services/audit.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type { AuditListQueryInput } from "../validators/audit.validators.js"

function requireAuth(req: Request) {
  if (!req.auth) {
    throw AppError.unauthorized()
  }
  return req.auth
}

function routeId(req: Request) {
  const id = req.params.id
  if (typeof id !== "string") {
    throw AppError.badRequest("Invalid identifier")
  }
  return id
}

export async function listAuditLogs(req: Request, res: Response) {
  const data = await auditService.listAuditLogs(requireAuth(req), req.validatedQuery as AuditListQueryInput)
  return sendSuccess(res, { data })
}

export async function getAuditLog(req: Request, res: Response) {
  const auditLog = await auditService.getAuditLog(requireAuth(req), routeId(req))
  return sendSuccess(res, { data: { auditLog } })
}
