import type { Request, Response } from "express"

import { HTTP_STATUS } from "../constants/http.js"
import * as agreementService from "../services/agreement.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  AgreementListQueryInput,
  CreateAgreementInput,
  UpdateAgreementInput,
} from "../validators/agreement.validators.js"

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

export async function listAgreements(req: Request, res: Response) {
  const data = await agreementService.listAgreements(
    requireAuth(req),
    req.validatedQuery as AgreementListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getAgreement(req: Request, res: Response) {
  const agreement = await agreementService.getAgreement(requireAuth(req), routeId(req))
  return sendSuccess(res, { data: { agreement } })
}

export async function createAgreement(req: Request, res: Response) {
  const agreement = await agreementService.createAgreement(
    requireAuth(req),
    req.body as CreateAgreementInput
  )
  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Agreement created",
    data: { agreement },
  })
}

export async function updateAgreement(req: Request, res: Response) {
  const agreement = await agreementService.updateAgreement(
    requireAuth(req),
    routeId(req),
    req.body as UpdateAgreementInput
  )
  return sendSuccess(res, { message: "Agreement updated", data: { agreement } })
}

export async function deleteAgreement(req: Request, res: Response) {
  await agreementService.deleteAgreement(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Agreement deleted" })
}
