import { Router } from "express"

import {
  createJoining,
  deleteJoining,
  getJoining,
  listJoinings,
  updateJoining,
} from "../controllers/joining.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  createJoiningSchema,
  joiningListQuerySchema,
  updateJoiningSchema,
} from "../validators/joining.validators.js"

export const joiningsRouter = Router()

joiningsRouter.use(authenticate)

const canRead = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

joiningsRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(joiningListQuerySchema),
  asyncHandler(listJoinings)
)

joiningsRouter.post(
  "/",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(createJoiningSchema),
  asyncHandler(createJoining)
)

joiningsRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getJoining))

joiningsRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(updateJoiningSchema),
  asyncHandler(updateJoining)
)

joiningsRouter.delete(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  asyncHandler(deleteJoining)
)
