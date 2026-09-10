import type { Request, Response } from "express"

import { HTTP_STATUS } from "../constants/http.js"
import * as candidateService from "../services/candidate.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  CandidateProfileListQueryInput,
  CreateCandidateProfileInput,
  UpdateCandidateProfileInput,
} from "../validators/candidate.validators.js"

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

export async function listCandidates(req: Request, res: Response) {
  const data = await candidateService.listCandidates(
    requireAuth(req),
    req.validatedQuery as CandidateProfileListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getCandidate(req: Request, res: Response) {
  const candidate = await candidateService.getCandidate(requireAuth(req), routeId(req))
  return sendSuccess(res, { data: { candidate } })
}

export async function createCandidate(req: Request, res: Response) {
  const candidate = await candidateService.createCandidate(
    requireAuth(req),
    req.body as CreateCandidateProfileInput
  )
  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Candidate created",
    data: { candidate },
  })
}

export async function updateCandidate(req: Request, res: Response) {
  const candidate = await candidateService.updateCandidate(
    requireAuth(req),
    routeId(req),
    req.body as UpdateCandidateProfileInput
  )
  return sendSuccess(res, { message: "Candidate updated", data: { candidate } })
}

export async function deleteCandidate(req: Request, res: Response) {
  await candidateService.deleteCandidate(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Candidate deleted" })
}
