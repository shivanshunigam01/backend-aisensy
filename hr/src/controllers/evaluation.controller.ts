import type { Request, Response } from "express"

import { HTTP_STATUS } from "../constants/http.js"
import * as evaluationService from "../services/evaluation.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  CreateEvaluationInput,
  EvaluationListQueryInput,
  UpdateEvaluationInput,
} from "../validators/evaluation.validators.js"

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

export async function listEvaluations(req: Request, res: Response) {
  const data = await evaluationService.listEvaluations(
    requireAuth(req),
    req.validatedQuery as EvaluationListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getEvaluation(req: Request, res: Response) {
  const evaluation = await evaluationService.getEvaluation(requireAuth(req), routeId(req))
  return sendSuccess(res, { data: { evaluation } })
}

export async function createEvaluation(req: Request, res: Response) {
  const evaluation = await evaluationService.createEvaluation(
    requireAuth(req),
    req.body as CreateEvaluationInput
  )
  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Evaluation recorded",
    data: { evaluation },
  })
}

export async function updateEvaluation(req: Request, res: Response) {
  const evaluation = await evaluationService.updateEvaluation(
    requireAuth(req),
    routeId(req),
    req.body as UpdateEvaluationInput
  )
  return sendSuccess(res, { message: "Evaluation updated", data: { evaluation } })
}

export async function deleteEvaluation(req: Request, res: Response) {
  await evaluationService.deleteEvaluation(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Evaluation deleted" })
}
