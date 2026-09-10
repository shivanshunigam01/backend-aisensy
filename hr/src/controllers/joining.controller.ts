import type { Request, Response } from "express"

import { HTTP_STATUS } from "../constants/http.js"
import * as joiningService from "../services/joining.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  CreateJoiningInput,
  JoiningListQueryInput,
  UpdateJoiningInput,
} from "../validators/joining.validators.js"

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

export async function listJoinings(req: Request, res: Response) {
  const data = await joiningService.listJoinings(
    requireAuth(req),
    req.validatedQuery as JoiningListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getJoining(req: Request, res: Response) {
  const joining = await joiningService.getJoining(requireAuth(req), routeId(req))
  return sendSuccess(res, { data: { joining } })
}

export async function createJoining(req: Request, res: Response) {
  const joining = await joiningService.createJoining(requireAuth(req), req.body as CreateJoiningInput)
  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Joining recorded",
    data: { joining },
  })
}

export async function updateJoining(req: Request, res: Response) {
  const joining = await joiningService.updateJoining(
    requireAuth(req),
    routeId(req),
    req.body as UpdateJoiningInput
  )
  return sendSuccess(res, { message: "Joining updated", data: { joining } })
}

export async function deleteJoining(req: Request, res: Response) {
  await joiningService.deleteJoining(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Joining deleted" })
}
