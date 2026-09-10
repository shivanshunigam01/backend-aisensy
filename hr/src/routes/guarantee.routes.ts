import { Router } from "express"

import {
  createGuarantee,
  deleteGuarantee,
  getGuarantee,
  listGuarantees,
  updateGuarantee,
} from "../controllers/guarantee.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  createGuaranteeSchema,
  guaranteeListQuerySchema,
  updateGuaranteeSchema,
} from "../validators/guarantee.validators.js"

export const guaranteesRouter = Router()

guaranteesRouter.use(authenticate)

const canRead = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

guaranteesRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(guaranteeListQuerySchema),
  asyncHandler(listGuarantees)
)

guaranteesRouter.post(
  "/",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(createGuaranteeSchema),
  asyncHandler(createGuarantee)
)

guaranteesRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getGuarantee))

guaranteesRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(updateGuaranteeSchema),
  asyncHandler(updateGuarantee)
)

guaranteesRouter.delete(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  asyncHandler(deleteGuarantee)
)
