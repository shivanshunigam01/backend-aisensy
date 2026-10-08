import type { Request, Response } from "express"

import * as incrementService from "../services/increment.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  ApplyIncrementsInput,
  IncrementWorksheetQueryInput,
} from "../validators/increment.validators.js"

function requireAuth(req: Request) {
  if (!req.auth) {
    throw AppError.unauthorized()
  }

  return req.auth
}

export async function getIncrementWorksheet(req: Request, res: Response) {
  const data = await incrementService.getIncrementWorksheet(
    requireAuth(req),
    req.validatedQuery as IncrementWorksheetQueryInput
  )
  return sendSuccess(res, { data })
}

export async function applyIncrements(req: Request, res: Response) {
  const data = await incrementService.applyPerformanceIncrements(
    requireAuth(req),
    req.body as ApplyIncrementsInput
  )
  return sendSuccess(res, { data })
}
