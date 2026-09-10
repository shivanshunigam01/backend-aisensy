import { Router } from "express"

import {
  createReplacement,
  deleteReplacement,
  getReplacement,
  listReplacements,
  updateReplacement,
} from "../controllers/replacement.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  createReplacementSchema,
  replacementListQuerySchema,
  updateReplacementSchema,
} from "../validators/replacement.validators.js"

export const replacementsRouter = Router()

replacementsRouter.use(authenticate)

const canRead = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

replacementsRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(replacementListQuerySchema),
  asyncHandler(listReplacements)
)

replacementsRouter.post(
  "/",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(createReplacementSchema),
  asyncHandler(createReplacement)
)

replacementsRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getReplacement))

replacementsRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(updateReplacementSchema),
  asyncHandler(updateReplacement)
)

replacementsRouter.delete(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  asyncHandler(deleteReplacement)
)
