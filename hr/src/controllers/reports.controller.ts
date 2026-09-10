import type { Request, Response } from "express"

import * as reportsService from "../services/reports.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type { ReportQueryInput } from "../validators/reports.validators.js"

function requireAuth(req: Request) {
  if (!req.auth) {
    throw AppError.unauthorized()
  }

  return req.auth
}

function query(req: Request) {
  return req.validatedQuery as ReportQueryInput
}

export async function employeeGrowth(req: Request, res: Response) {
  const data = await reportsService.employeeGrowthReport(requireAuth(req), query(req))
  return sendSuccess(res, { data })
}

export async function attendance(req: Request, res: Response) {
  const data = await reportsService.attendanceReport(requireAuth(req), query(req))
  return sendSuccess(res, { data })
}

export async function leave(req: Request, res: Response) {
  const data = await reportsService.leaveReport(requireAuth(req), query(req))
  return sendSuccess(res, { data })
}

export async function department(req: Request, res: Response) {
  const data = await reportsService.departmentReport(requireAuth(req), query(req))
  return sendSuccess(res, { data })
}

export async function recruitment(req: Request, res: Response) {
  const data = await reportsService.recruitmentReport(requireAuth(req), query(req))
  return sendSuccess(res, { data })
}

export async function payroll(req: Request, res: Response) {
  const data = await reportsService.payrollReport(requireAuth(req), query(req))
  return sendSuccess(res, { data })
}
