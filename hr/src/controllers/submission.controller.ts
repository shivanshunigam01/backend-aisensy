import type { Request, Response } from "express"

import { HTTP_STATUS } from "../constants/http.js"
import * as submissionService from "../services/submission.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  CreateSubmissionInput,
  SubmissionListQueryInput,
  UpdateSubmissionInput,
} from "../validators/submission.validators.js"

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

export async function listSubmissions(req: Request, res: Response) {
  const data = await submissionService.listSubmissions(
    requireAuth(req),
    req.validatedQuery as SubmissionListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getSubmission(req: Request, res: Response) {
  const submission = await submissionService.getSubmission(requireAuth(req), routeId(req))
  return sendSuccess(res, { data: { submission } })
}

export async function createSubmission(req: Request, res: Response) {
  const submission = await submissionService.createSubmission(
    requireAuth(req),
    req.body as CreateSubmissionInput
  )
  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Submission recorded",
    data: { submission },
  })
}

export async function updateSubmission(req: Request, res: Response) {
  const submission = await submissionService.updateSubmission(
    requireAuth(req),
    routeId(req),
    req.body as UpdateSubmissionInput
  )
  return sendSuccess(res, { message: "Submission updated", data: { submission } })
}

export async function deleteSubmission(req: Request, res: Response) {
  await submissionService.deleteSubmission(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Submission deleted" })
}
