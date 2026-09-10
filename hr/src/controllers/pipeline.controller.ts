import type { Request, Response } from "express"

import * as pipelineService from "../services/pipeline.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  PipelineListQueryInput,
  PipelineTransitionInput,
} from "../validators/pipeline.validators.js"

function requireAuth(req: Request) {
  if (!req.auth) {
    throw AppError.unauthorized()
  }
  return req.auth
}

export async function getMandatePipeline(req: Request, res: Response) {
  const data = await pipelineService.getMandatePipeline(
    requireAuth(req),
    req.validatedQuery as PipelineListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function transitionPipelineStage(req: Request, res: Response) {
  const data = await pipelineService.transitionPipelineStage(
    requireAuth(req),
    req.body as PipelineTransitionInput
  )
  return sendSuccess(res, { message: data.message, data })
}
