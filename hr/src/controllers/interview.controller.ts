import type { Request, Response } from "express"

import { HTTP_STATUS } from "../constants/http.js"
import * as interviewService from "../services/interview.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  CreateInterviewInput,
  InterviewListQueryInput,
  UpdateInterviewInput,
} from "../validators/interview.validators.js"

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

export async function listInterviews(req: Request, res: Response) {
  const data = await interviewService.listInterviews(
    requireAuth(req),
    req.validatedQuery as InterviewListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getInterview(req: Request, res: Response) {
  const interview = await interviewService.getInterview(requireAuth(req), routeId(req))
  return sendSuccess(res, { data: { interview } })
}

export async function createInterview(req: Request, res: Response) {
  const interview = await interviewService.createInterview(
    requireAuth(req),
    req.body as CreateInterviewInput
  )
  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Interview scheduled",
    data: { interview },
  })
}

export async function updateInterview(req: Request, res: Response) {
  const interview = await interviewService.updateInterview(
    requireAuth(req),
    routeId(req),
    req.body as UpdateInterviewInput
  )
  return sendSuccess(res, { message: "Interview updated", data: { interview } })
}

export async function deleteInterview(req: Request, res: Response) {
  await interviewService.deleteInterview(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Interview deleted" })
}
