import type { Request, Response } from "express"

import { HTTP_STATUS } from "../constants/http.js"
import * as guaranteeService from "../services/guarantee.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  CreateGuaranteeInput,
  GuaranteeListQueryInput,
  UpdateGuaranteeInput,
} from "../validators/guarantee.validators.js"

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

export async function listGuarantees(req: Request, res: Response) {
  const data = await guaranteeService.listGuarantees(
    requireAuth(req),
    req.validatedQuery as GuaranteeListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getGuarantee(req: Request, res: Response) {
  const guarantee = await guaranteeService.getGuarantee(requireAuth(req), routeId(req))
  return sendSuccess(res, { data: { guarantee } })
}

export async function createGuarantee(req: Request, res: Response) {
  const guarantee = await guaranteeService.createGuarantee(
    requireAuth(req),
    req.body as CreateGuaranteeInput
  )
  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Guarantee tracking recorded",
    data: { guarantee },
  })
}

export async function updateGuarantee(req: Request, res: Response) {
  const guarantee = await guaranteeService.updateGuarantee(
    requireAuth(req),
    routeId(req),
    req.body as UpdateGuaranteeInput
  )
  return sendSuccess(res, { message: "Guarantee tracking updated", data: { guarantee } })
}

export async function deleteGuarantee(req: Request, res: Response) {
  await guaranteeService.deleteGuarantee(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Guarantee tracking deleted" })
}
