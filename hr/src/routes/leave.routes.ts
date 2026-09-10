import { Router } from "express"

import {
  applyLeave,
  approveLeave,
  cancelLeave,
  createType,
  getCalendar,
  getRequest,
  listBalances,
  listRequests,
  listTypes,
  previewLeave,
  rejectLeave,
  updateType,
} from "../controllers/leave.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  applyLeaveSchema,
  createLeaveTypeSchema,
  decideLeaveSchema,
  leaveBalanceQuerySchema,
  leaveCalendarQuerySchema,
  leaveListQuerySchema,
  leavePreviewQuerySchema,
  updateLeaveTypeSchema,
} from "../validators/leave.validators.js"

export const leaveRouter = Router()

leaveRouter.use(authenticate)

const canRead = [
  PERMISSIONS.LEAVE_READ,
  PERMISSIONS.LEAVE_READ_TEAM,
  PERMISSIONS.LEAVE_READ_SELF,
  PERMISSIONS.LEAVE_APPROVE_TEAM,
  PERMISSIONS.LEAVE_CREATE_SELF,
] as const

const canDecide = [PERMISSIONS.LEAVE_APPROVE_TEAM, PERMISSIONS.LEAVE_MANAGE] as const

leaveRouter.get("/types", authorizePermissions(...canRead), asyncHandler(listTypes))

leaveRouter.post(
  "/types",
  authorizePermissions(PERMISSIONS.LEAVE_MANAGE),
  validateBody(createLeaveTypeSchema),
  asyncHandler(createType)
)

leaveRouter.patch(
  "/types/:id",
  authorizePermissions(PERMISSIONS.LEAVE_MANAGE),
  validateBody(updateLeaveTypeSchema),
  asyncHandler(updateType)
)

leaveRouter.get(
  "/balances",
  authorizePermissions(...canRead),
  validateQuery(leaveBalanceQuerySchema),
  asyncHandler(listBalances)
)

leaveRouter.get(
  "/preview",
  authorizePermissions(PERMISSIONS.LEAVE_CREATE_SELF, PERMISSIONS.LEAVE_MANAGE),
  validateQuery(leavePreviewQuerySchema),
  asyncHandler(previewLeave)
)

leaveRouter.get(
  "/calendar",
  authorizePermissions(...canRead),
  validateQuery(leaveCalendarQuerySchema),
  asyncHandler(getCalendar)
)

leaveRouter.get(
  "/requests",
  authorizePermissions(...canRead),
  validateQuery(leaveListQuerySchema),
  asyncHandler(listRequests)
)

leaveRouter.post(
  "/requests",
  authorizePermissions(PERMISSIONS.LEAVE_CREATE_SELF),
  validateBody(applyLeaveSchema),
  asyncHandler(applyLeave)
)

leaveRouter.get("/requests/:id", authorizePermissions(...canRead), asyncHandler(getRequest))

leaveRouter.post(
  "/requests/:id/cancel",
  authorizePermissions(PERMISSIONS.LEAVE_CREATE_SELF, PERMISSIONS.LEAVE_MANAGE),
  asyncHandler(cancelLeave)
)

leaveRouter.post(
  "/requests/:id/approve",
  authorizePermissions(...canDecide),
  validateBody(decideLeaveSchema),
  asyncHandler(approveLeave)
)

leaveRouter.post(
  "/requests/:id/reject",
  authorizePermissions(...canDecide),
  validateBody(decideLeaveSchema),
  asyncHandler(rejectLeave)
)
