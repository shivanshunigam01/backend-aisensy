import type { Request, Response } from "express"

import * as attendanceService from "../services/attendance.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  AttendanceCalendarQueryInput,
  AttendanceDailyQueryInput,
  AttendanceListQueryInput,
  AttendanceMonthlyQueryInput,
  CheckInInput,
  UpdateAttendanceInput,
} from "../validators/attendance.validators.js"

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

export async function getToday(req: Request, res: Response) {
  const data = await attendanceService.getToday(requireAuth(req))
  return sendSuccess(res, { data })
}

export async function checkIn(req: Request, res: Response) {
  const data = await attendanceService.checkIn(requireAuth(req), req.body as CheckInInput)
  return sendSuccess(res, { message: "Checked in", data })
}

export async function checkOut(req: Request, res: Response) {
  const data = await attendanceService.checkOut(requireAuth(req))
  return sendSuccess(res, { message: "Checked out", data })
}

export async function startBreak(req: Request, res: Response) {
  const data = await attendanceService.startBreak(requireAuth(req))
  return sendSuccess(res, { message: "Break started", data })
}

export async function endBreak(req: Request, res: Response) {
  const data = await attendanceService.endBreak(requireAuth(req))
  return sendSuccess(res, { message: "Break ended", data })
}

export async function getCalendar(req: Request, res: Response) {
  const data = await attendanceService.getCalendar(
    requireAuth(req),
    req.validatedQuery as AttendanceCalendarQueryInput
  )
  return sendSuccess(res, { data })
}

export async function listAttendance(req: Request, res: Response) {
  const data = await attendanceService.listAttendance(
    requireAuth(req),
    req.validatedQuery as AttendanceListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getDailyOverview(req: Request, res: Response) {
  const data = await attendanceService.getDailyOverview(
    requireAuth(req),
    req.validatedQuery as AttendanceDailyQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getMonthlyReport(req: Request, res: Response) {
  const data = await attendanceService.getMonthlyReport(
    requireAuth(req),
    req.validatedQuery as AttendanceMonthlyQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getAttendance(req: Request, res: Response) {
  const attendance = await attendanceService.getAttendance(requireAuth(req), routeId(req))
  return sendSuccess(res, { data: { attendance } })
}

export async function updateAttendance(req: Request, res: Response) {
  const attendance = await attendanceService.updateAttendance(
    requireAuth(req),
    routeId(req),
    req.body as UpdateAttendanceInput
  )
  return sendSuccess(res, { message: "Attendance updated", data: { attendance } })
}
