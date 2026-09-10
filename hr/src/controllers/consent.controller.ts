import type { Request, Response } from "express"

import { HTTP_STATUS } from "../constants/http.js"
import * as consentService from "../services/consent.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  ConsentListQueryInput,
  CreateConsentInput,
  UpdateConsentInput,
} from "../validators/consent.validators.js"

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

export async function listConsents(req: Request, res: Response) {
  const data = await consentService.listConsents(
    requireAuth(req),
    req.validatedQuery as ConsentListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getConsent(req: Request, res: Response) {
  const consent = await consentService.getConsent(requireAuth(req), routeId(req))
  return sendSuccess(res, { data: { consent } })
}

export async function createConsent(req: Request, res: Response) {
  const consent = await consentService.createConsent(
    requireAuth(req),
    req.body as CreateConsentInput
  )
  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Consent recorded",
    data: { consent },
  })
}

export async function updateConsent(req: Request, res: Response) {
  const consent = await consentService.updateConsent(
    requireAuth(req),
    routeId(req),
    req.body as UpdateConsentInput
  )
  return sendSuccess(res, { message: "Consent updated", data: { consent } })
}

export async function deleteConsent(req: Request, res: Response) {
  await consentService.deleteConsent(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Consent deleted" })
}
