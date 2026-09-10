import type { Request, Response } from "express"

import * as recruitmentService from "../services/recruitment.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  ApplicationListQueryInput,
  BoardQueryInput,
  CandidateListQueryInput,
  CreateApplicationInput,
  CreateCandidateInput,
  CreateJobInput,
  JobListQueryInput,
  UpdateApplicationInput,
  UpdateCandidateInput,
  UpdateJobInput,
} from "../validators/recruitment.validators.js"

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

export async function listJobs(req: Request, res: Response) {
  const data = await recruitmentService.listJobs(
    requireAuth(req),
    req.validatedQuery as JobListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getJob(req: Request, res: Response) {
  const data = await recruitmentService.getJob(requireAuth(req), routeId(req))
  return sendSuccess(res, { data })
}

export async function createJob(req: Request, res: Response) {
  const data = await recruitmentService.createJob(requireAuth(req), req.body as CreateJobInput)
  return sendSuccess(res, { message: "Job created", data })
}

export async function updateJob(req: Request, res: Response) {
  const data = await recruitmentService.updateJob(
    requireAuth(req),
    routeId(req),
    req.body as UpdateJobInput
  )
  return sendSuccess(res, { message: "Job updated", data })
}

export async function deleteJob(req: Request, res: Response) {
  await recruitmentService.deleteJob(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Job deleted" })
}

export async function listCandidates(req: Request, res: Response) {
  const data = await recruitmentService.listCandidates(
    requireAuth(req),
    req.validatedQuery as CandidateListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getCandidate(req: Request, res: Response) {
  const data = await recruitmentService.getCandidate(requireAuth(req), routeId(req))
  return sendSuccess(res, { data })
}

export async function createCandidate(req: Request, res: Response) {
  const data = await recruitmentService.createCandidate(
    requireAuth(req),
    req.body as CreateCandidateInput
  )
  return sendSuccess(res, { message: "Candidate added", data })
}

export async function updateCandidate(req: Request, res: Response) {
  const data = await recruitmentService.updateCandidate(
    requireAuth(req),
    routeId(req),
    req.body as UpdateCandidateInput
  )
  return sendSuccess(res, { message: "Candidate updated", data })
}

export async function listApplications(req: Request, res: Response) {
  const data = await recruitmentService.listApplications(
    requireAuth(req),
    req.validatedQuery as ApplicationListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getApplication(req: Request, res: Response) {
  const data = await recruitmentService.getApplication(requireAuth(req), routeId(req))
  return sendSuccess(res, { data })
}

export async function createApplication(req: Request, res: Response) {
  const data = await recruitmentService.createApplication(
    requireAuth(req),
    req.body as CreateApplicationInput
  )
  return sendSuccess(res, { message: "Application created", data })
}

export async function updateApplication(req: Request, res: Response) {
  const data = await recruitmentService.updateApplication(
    requireAuth(req),
    routeId(req),
    req.body as UpdateApplicationInput
  )
  return sendSuccess(res, { message: "Application updated", data })
}

export async function getBoard(req: Request, res: Response) {
  const data = await recruitmentService.getBoard(
    requireAuth(req),
    req.validatedQuery as BoardQueryInput
  )
  return sendSuccess(res, { data })
}
