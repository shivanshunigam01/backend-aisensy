import type { Request, Response } from "express"

import { HTTP_STATUS } from "../constants/http.js"
import * as publicCareerService from "../services/public-career.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  PublicCareerApplyInput,
  PublicCareerListQueryInput,
} from "../validators/public-career.validators.js"

function routeParam(req: Request, name: string) {
  const value = req.params[name]
  if (typeof value !== "string" || !value.trim()) {
    throw AppError.badRequest("Invalid identifier")
  }
  return value.trim()
}

export async function listPublicCareers(req: Request, res: Response) {
  const data = await publicCareerService.listPublicCareers(
    req.validatedQuery as PublicCareerListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getPublicCareer(req: Request, res: Response) {
  const data = await publicCareerService.getPublicCareer(routeParam(req, "mandateId"))
  return sendSuccess(res, { data })
}

export async function applyToPublicCareer(req: Request, res: Response) {
  const data = await publicCareerService.applyToPublicCareer(
    routeParam(req, "mandateId"),
    req.body as PublicCareerApplyInput,
    req.file
  )
  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Application submitted successfully",
    data,
  })
}
