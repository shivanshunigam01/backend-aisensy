import type { Request, Response } from "express"

import { HTTP_STATUS } from "../constants/http.js"
import * as replacementService from "../services/replacement.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  CreateReplacementInput,
  ReplacementListQueryInput,
  UpdateReplacementInput,
} from "../validators/replacement.validators.js"

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

export async function listReplacements(req: Request, res: Response) {
  const data = await replacementService.listReplacements(
    requireAuth(req),
    req.validatedQuery as ReplacementListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getReplacement(req: Request, res: Response) {
  const replacement = await replacementService.getReplacement(requireAuth(req), routeId(req))
  return sendSuccess(res, { data: { replacement } })
}

export async function createReplacement(req: Request, res: Response) {
  const replacement = await replacementService.createReplacement(
    requireAuth(req),
    req.body as CreateReplacementInput
  )
  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Replacement case recorded",
    data: { replacement },
  })
}

export async function updateReplacement(req: Request, res: Response) {
  const replacement = await replacementService.updateReplacement(
    requireAuth(req),
    routeId(req),
    req.body as UpdateReplacementInput
  )
  return sendSuccess(res, { message: "Replacement case updated", data: { replacement } })
}

export async function deleteReplacement(req: Request, res: Response) {
  await replacementService.deleteReplacement(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Replacement case deleted" })
}
