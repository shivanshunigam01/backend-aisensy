import type { Request, Response } from "express"

import { HTTP_STATUS } from "../constants/http.js"
import * as followUpService from "../services/follow-up.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  CreateFollowUpInput,
  FollowUpListQueryInput,
  UpdateFollowUpInput,
} from "../validators/follow-up.validators.js"

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

export async function listFollowUps(req: Request, res: Response) {
  const data = await followUpService.listFollowUps(
    requireAuth(req),
    req.validatedQuery as FollowUpListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getFollowUp(req: Request, res: Response) {
  const followUp = await followUpService.getFollowUp(requireAuth(req), routeId(req))
  return sendSuccess(res, { data: { followUp } })
}

export async function createFollowUp(req: Request, res: Response) {
  const followUp = await followUpService.createFollowUp(
    requireAuth(req),
    req.body as CreateFollowUpInput
  )
  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Follow-up recorded",
    data: { followUp },
  })
}

export async function updateFollowUp(req: Request, res: Response) {
  const followUp = await followUpService.updateFollowUp(
    requireAuth(req),
    routeId(req),
    req.body as UpdateFollowUpInput
  )
  return sendSuccess(res, { message: "Follow-up updated", data: { followUp } })
}

export async function deleteFollowUp(req: Request, res: Response) {
  await followUpService.deleteFollowUp(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Follow-up deleted" })
}
