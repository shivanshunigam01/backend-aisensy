import type { Request, Response } from "express"

import * as payrollService from "../services/payroll.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  CreateSalaryStructureInput,
  GeneratePayrollInput,
  PayrollListQueryInput,
  PayrollPreviewQueryInput,
  StructureListQueryInput,
  UpdateSalaryStructureInput,
} from "../validators/payroll.validators.js"

function requireAuth(req: Request) {
  if (!req.auth) {
    throw AppError.unauthorized()
  }

  return req.auth
}

function routeId(req: Request, key = "id") {
  const id = req.params[key]
  if (typeof id !== "string") {
    throw AppError.badRequest("Invalid identifier")
  }
  return id
}

export async function listPayrolls(req: Request, res: Response) {
  const data = await payrollService.listPayrolls(
    requireAuth(req),
    req.validatedQuery as PayrollListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function previewPayroll(req: Request, res: Response) {
  const data = await payrollService.previewPayroll(
    requireAuth(req),
    req.validatedQuery as PayrollPreviewQueryInput
  )
  return sendSuccess(res, { data })
}

export async function generatePayroll(req: Request, res: Response) {
  const data = await payrollService.generatePayroll(
    requireAuth(req),
    req.body as GeneratePayrollInput
  )
  return sendSuccess(res, { message: "Payroll generated", data })
}

export async function getPayroll(req: Request, res: Response) {
  const data = await payrollService.getPayroll(requireAuth(req), routeId(req))
  return sendSuccess(res, { data })
}

export async function getPayslip(req: Request, res: Response) {
  const data = await payrollService.getPayslip(requireAuth(req), routeId(req))
  return sendSuccess(res, { data })
}

export async function markPayrollPaid(req: Request, res: Response) {
  const data = await payrollService.markPayrollPaid(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Payroll marked as paid", data })
}

export async function listSalaryStructures(req: Request, res: Response) {
  const data = await payrollService.listSalaryStructures(
    requireAuth(req),
    req.validatedQuery as StructureListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getSalaryStructure(req: Request, res: Response) {
  const data = await payrollService.getSalaryStructure(requireAuth(req), routeId(req))
  return sendSuccess(res, { data })
}

export async function createSalaryStructure(req: Request, res: Response) {
  const data = await payrollService.createSalaryStructure(
    requireAuth(req),
    req.body as CreateSalaryStructureInput
  )
  return sendSuccess(res, { message: "Salary structure saved", data })
}

export async function updateSalaryStructure(req: Request, res: Response) {
  const data = await payrollService.updateSalaryStructure(
    requireAuth(req),
    routeId(req),
    req.body as UpdateSalaryStructureInput
  )
  return sendSuccess(res, { message: "Salary structure updated", data })
}
