import type { Request, Response } from "express"

import * as jobApplicationService from "../services/job-application.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  JobApplicationListQueryInput,
  UpdateJobApplicationInput,
} from "../validators/public-career.validators.js"

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

export async function listJobApplications(req: Request, res: Response) {
  const data = await jobApplicationService.listJobApplications(
    requireAuth(req),
    req.validatedQuery as JobApplicationListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getJobApplication(req: Request, res: Response) {
  const data = await jobApplicationService.getJobApplication(requireAuth(req), routeId(req))
  return sendSuccess(res, { data: { application: data } })
}

export async function updateJobApplication(req: Request, res: Response) {
  const data = await jobApplicationService.updateJobApplication(
    requireAuth(req),
    routeId(req),
    req.body as UpdateJobApplicationInput
  )
  return sendSuccess(res, { message: "Application updated", data: { application: data } })
}
