import { Router } from "express"

import {
  createFollowUp,
  deleteFollowUp,
  getFollowUp,
  listFollowUps,
  updateFollowUp,
} from "../controllers/follow-up.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  createFollowUpSchema,
  followUpListQuerySchema,
  updateFollowUpSchema,
} from "../validators/follow-up.validators.js"

export const followUpsRouter = Router()

followUpsRouter.use(authenticate)

const canRead = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

followUpsRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(followUpListQuerySchema),
  asyncHandler(listFollowUps)
)

followUpsRouter.post(
  "/",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(createFollowUpSchema),
  asyncHandler(createFollowUp)
)

followUpsRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getFollowUp))

followUpsRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(updateFollowUpSchema),
  asyncHandler(updateFollowUp)
)

followUpsRouter.delete(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  asyncHandler(deleteFollowUp)
)
