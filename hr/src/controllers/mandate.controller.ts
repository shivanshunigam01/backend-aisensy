import type { Request, Response } from "express"

import { HTTP_STATUS } from "../constants/http.js"
import * as mandateService from "../services/mandate.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  CreateMandateInput,
  MandateListQueryInput,
  UpdateMandateInput,
} from "../validators/mandate.validators.js"

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

export async function listMandates(req: Request, res: Response) {
  const data = await mandateService.listMandates(
    requireAuth(req),
    req.validatedQuery as MandateListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getMandate(req: Request, res: Response) {
  const mandate = await mandateService.getMandate(requireAuth(req), routeId(req))
  return sendSuccess(res, { data: { mandate } })
}

export async function createMandate(req: Request, res: Response) {
  const mandate = await mandateService.createMandate(
    requireAuth(req),
    req.body as CreateMandateInput
  )
  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Mandate created",
    data: { mandate },
  })
}

export async function updateMandate(req: Request, res: Response) {
  const mandate = await mandateService.updateMandate(
    requireAuth(req),
    routeId(req),
    req.body as UpdateMandateInput
  )
  return sendSuccess(res, { message: "Mandate updated", data: { mandate } })
}

export async function deleteMandate(req: Request, res: Response) {
  await mandateService.deleteMandate(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Mandate deleted" })
}
