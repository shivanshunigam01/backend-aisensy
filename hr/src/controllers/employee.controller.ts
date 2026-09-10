import type { Request, Response } from "express"

import { HTTP_STATUS } from "../constants/http.js"
import * as employeeService from "../services/employee.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  CreateEmployeeInput,
  EmployeeListQueryInput,
  UpdateEmployeeInput,
} from "../validators/employee.validators.js"

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

function listQuery(req: Request) {
  return req.validatedQuery as EmployeeListQueryInput
}

export async function listEmployees(req: Request, res: Response) {
  const result = await employeeService.listEmployees(requireAuth(req), listQuery(req))
  return sendSuccess(res, { data: result })
}

export async function getMyEmployee(req: Request, res: Response) {
  const employee = await employeeService.getMyEmployee(requireAuth(req))
  return sendSuccess(res, { data: { employee } })
}

export async function getEmployee(req: Request, res: Response) {
  const employee = await employeeService.getEmployee(requireAuth(req), routeId(req))
  return sendSuccess(res, { data: { employee } })
}

export async function createEmployee(req: Request, res: Response) {
  const employee = await employeeService.createEmployee(
    requireAuth(req),
    req.body as CreateEmployeeInput
  )
  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Employee created",
    data: { employee },
  })
}

export async function updateEmployee(req: Request, res: Response) {
  const employee = await employeeService.updateEmployee(
    requireAuth(req),
    routeId(req),
    req.body as UpdateEmployeeInput
  )
  return sendSuccess(res, {
    message: "Employee updated",
    data: { employee },
  })
}

export async function activateEmployee(req: Request, res: Response) {
  const employee = await employeeService.activateEmployee(requireAuth(req), routeId(req))
  return sendSuccess(res, {
    message: "Employee activated",
    data: { employee },
  })
}

export async function deactivateEmployee(req: Request, res: Response) {
  const employee = await employeeService.deactivateEmployee(requireAuth(req), routeId(req))
  return sendSuccess(res, {
    message: "Employee deactivated",
    data: { employee },
  })
}
