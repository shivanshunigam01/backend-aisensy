import type { Request, Response } from "express"

import * as dashboardService from "../services/dashboard.service.js"
import * as recruitmentDashboardService from "../services/recruitment-dashboard.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type { RecruitmentDashboardQueryInput } from "../validators/recruitment-dashboard.validators.js"

function requireAuth(req: Request) {
  if (!req.auth) {
    throw AppError.unauthorized()
  }

  return req.auth
}

export async function getDashboard(req: Request, res: Response) {
  const dashboard = await dashboardService.getDashboard(requireAuth(req))
  return sendSuccess(res, { data: dashboard })
}

export async function getRecruitmentDashboard(req: Request, res: Response) {
  const dashboard = await recruitmentDashboardService.getRecruitmentDashboard(
    requireAuth(req),
    req.validatedQuery as RecruitmentDashboardQueryInput
  )
  return sendSuccess(res, { data: dashboard })
}

