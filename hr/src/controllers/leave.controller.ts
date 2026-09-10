import type { Request, Response } from "express"

import * as leaveService from "../services/leave.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  ApplyLeaveInput,
  CreateLeaveTypeInput,
  DecideLeaveInput,
  LeaveBalanceQueryInput,
  LeaveCalendarQueryInput,
  LeaveListQueryInput,
  LeavePreviewQueryInput,
  UpdateLeaveTypeInput,
} from "../validators/leave.validators.js"

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

export async function listTypes(req: Request, res: Response) {
  const data = await leaveService.listLeaveTypes(requireAuth(req))
  return sendSuccess(res, { data })
}

export async function createType(req: Request, res: Response) {
  const data = await leaveService.createLeaveType(requireAuth(req), req.body as CreateLeaveTypeInput)
  return sendSuccess(res, { message: "Leave type created", data })
}

export async function updateType(req: Request, res: Response) {
  const data = await leaveService.updateLeaveType(
    requireAuth(req),
    routeId(req),
    req.body as UpdateLeaveTypeInput
  )
  return sendSuccess(res, { message: "Leave type updated", data })
}

export async function listBalances(req: Request, res: Response) {
  const data = await leaveService.listBalances(
    requireAuth(req),
    req.validatedQuery as LeaveBalanceQueryInput
  )
  return sendSuccess(res, { data })
}

export async function previewLeave(req: Request, res: Response) {
  const data = await leaveService.previewLeave(
    requireAuth(req),
    req.validatedQuery as LeavePreviewQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getCalendar(req: Request, res: Response) {
  const data = await leaveService.getLeaveCalendar(
    requireAuth(req),
    req.validatedQuery as LeaveCalendarQueryInput
  )
  return sendSuccess(res, { data })
}

export async function listRequests(req: Request, res: Response) {
  const data = await leaveService.listLeaveRequests(
    requireAuth(req),
    req.validatedQuery as LeaveListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function applyLeave(req: Request, res: Response) {
  const data = await leaveService.applyLeave(requireAuth(req), req.body as ApplyLeaveInput)
  return sendSuccess(res, { message: "Leave request submitted", data })
}

export async function getRequest(req: Request, res: Response) {
  const data = await leaveService.getLeaveRequest(requireAuth(req), routeId(req))
  return sendSuccess(res, { data })
}

export async function cancelLeave(req: Request, res: Response) {
  const data = await leaveService.cancelLeave(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Leave request cancelled", data })
}

export async function approveLeave(req: Request, res: Response) {
  const data = await leaveService.approveLeave(
    requireAuth(req),
    routeId(req),
    req.body as DecideLeaveInput
  )
  return sendSuccess(res, { message: "Leave approved", data })
}

export async function rejectLeave(req: Request, res: Response) {
  const data = await leaveService.rejectLeave(
    requireAuth(req),
    routeId(req),
    req.body as DecideLeaveInput
  )
  return sendSuccess(res, { message: "Leave declined", data })
}
