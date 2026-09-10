import { Router } from "express"

import {
  checkIn,
  checkOut,
  endBreak,
  getAttendance,
  getCalendar,
  getDailyOverview,
  getMonthlyReport,
  getToday,
  listAttendance,
  startBreak,
  updateAttendance,
} from "../controllers/attendance.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  attendanceCalendarQuerySchema,
  attendanceDailyQuerySchema,
  attendanceListQuerySchema,
  attendanceMonthlyQuerySchema,
  checkInSchema,
  updateAttendanceSchema,
} from "../validators/attendance.validators.js"

export const attendanceRouter = Router()

attendanceRouter.use(authenticate)

const canRead = [
  PERMISSIONS.ATTENDANCE_READ,
  PERMISSIONS.ATTENDANCE_READ_TEAM,
  PERMISSIONS.ATTENDANCE_READ_SELF,
] as const

const canOverview = [
  PERMISSIONS.ATTENDANCE_READ,
  PERMISSIONS.ATTENDANCE_READ_TEAM,
  PERMISSIONS.ATTENDANCE_MANAGE,
] as const

const canPunch = [PERMISSIONS.ATTENDANCE_CHECK_IN, PERMISSIONS.ATTENDANCE_READ_SELF] as const

attendanceRouter.get("/today", authorizePermissions(...canPunch), asyncHandler(getToday))

attendanceRouter.post(
  "/check-in",
  authorizePermissions(PERMISSIONS.ATTENDANCE_CHECK_IN),
  validateBody(checkInSchema),
  asyncHandler(checkIn)
)

attendanceRouter.post(
  "/check-out",
  authorizePermissions(PERMISSIONS.ATTENDANCE_CHECK_IN),
  asyncHandler(checkOut)
)

attendanceRouter.post(
  "/break/start",
  authorizePermissions(PERMISSIONS.ATTENDANCE_CHECK_IN),
  asyncHandler(startBreak)
)

attendanceRouter.post(
  "/break/end",
  authorizePermissions(PERMISSIONS.ATTENDANCE_CHECK_IN),
  asyncHandler(endBreak)
)

attendanceRouter.get(
  "/calendar",
  authorizePermissions(...canRead),
  validateQuery(attendanceCalendarQuerySchema),
  asyncHandler(getCalendar)
)

attendanceRouter.get(
  "/daily",
  authorizePermissions(...canOverview),
  validateQuery(attendanceDailyQuerySchema),
  asyncHandler(getDailyOverview)
)

attendanceRouter.get(
  "/reports/monthly",
  authorizePermissions(...canOverview),
  validateQuery(attendanceMonthlyQuerySchema),
  asyncHandler(getMonthlyReport)
)

attendanceRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(attendanceListQuerySchema),
  asyncHandler(listAttendance)
)

attendanceRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getAttendance))

attendanceRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.ATTENDANCE_MANAGE),
  validateBody(updateAttendanceSchema),
  asyncHandler(updateAttendance)
)
