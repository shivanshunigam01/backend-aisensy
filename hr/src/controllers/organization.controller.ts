import type { Request, Response } from "express"

import { HTTP_STATUS } from "../constants/http.js"
import * as organizationService from "../services/organization.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  CreateDepartmentInput,
  CreateDesignationInput,
  ListQueryInput,
  UpdateDepartmentInput,
  UpdateDesignationInput,
  UpdateOrganizationInput,
} from "../validators/organization.validators.js"

function requireOrgId(req: Request) {
  if (!req.auth) {
    throw AppError.unauthorized()
  }

  return req.auth.organizationId
}

function routeId(req: Request) {
  const id = req.params.id
  if (typeof id !== "string") {
    throw AppError.badRequest("Invalid identifier")
  }
  return id
}

function listQuery(req: Request) {
  return req.validatedQuery as ListQueryInput
}

export async function getOrganization(req: Request, res: Response) {
  const organization = await organizationService.getOrganization(requireOrgId(req))
  return sendSuccess(res, { data: { organization } })
}

export async function updateOrganization(req: Request, res: Response) {
  const organization = await organizationService.updateOrganization(
    requireOrgId(req),
    req.body as UpdateOrganizationInput
  )
  return sendSuccess(res, {
    message: "Organization updated",
    data: { organization },
  })
}

export async function listMembers(req: Request, res: Response) {
  const members = await organizationService.listMembers(requireOrgId(req))
  return sendSuccess(res, { data: { items: members } })
}

export async function listDepartments(req: Request, res: Response) {
  const result = await organizationService.listDepartments(requireOrgId(req), listQuery(req))
  return sendSuccess(res, { data: result })
}

export async function getDepartment(req: Request, res: Response) {
  const department = await organizationService.getDepartment(requireOrgId(req), routeId(req))
  return sendSuccess(res, { data: { department } })
}

export async function createDepartment(req: Request, res: Response) {
  const department = await organizationService.createDepartment(
    requireOrgId(req),
    req.body as CreateDepartmentInput
  )
  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Department created",
    data: { department },
  })
}

export async function updateDepartment(req: Request, res: Response) {
  const department = await organizationService.updateDepartment(
    requireOrgId(req),
    routeId(req),
    req.body as UpdateDepartmentInput
  )
  return sendSuccess(res, {
    message: "Department updated",
    data: { department },
  })
}

export async function deleteDepartment(req: Request, res: Response) {
  await organizationService.deleteDepartment(requireOrgId(req), routeId(req))
  return sendSuccess(res, { message: "Department deleted" })
}

export async function listDesignations(req: Request, res: Response) {
  const result = await organizationService.listDesignations(requireOrgId(req), listQuery(req))
  return sendSuccess(res, { data: result })
}

export async function getDesignation(req: Request, res: Response) {
  const designation = await organizationService.getDesignation(requireOrgId(req), routeId(req))
  return sendSuccess(res, { data: { designation } })
}

export async function createDesignation(req: Request, res: Response) {
  const designation = await organizationService.createDesignation(
    requireOrgId(req),
    req.body as CreateDesignationInput
  )
  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: "Designation created",
    data: { designation },
  })
}

export async function updateDesignation(req: Request, res: Response) {
  const designation = await organizationService.updateDesignation(
    requireOrgId(req),
    routeId(req),
    req.body as UpdateDesignationInput
  )
  return sendSuccess(res, {
    message: "Designation updated",
    data: { designation },
  })
}

export async function deleteDesignation(req: Request, res: Response) {
  await organizationService.deleteDesignation(requireOrgId(req), routeId(req))
  return sendSuccess(res, { message: "Designation deleted" })
}
