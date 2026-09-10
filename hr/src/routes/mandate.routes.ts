import { Router } from "express"

import {
  createMandate,
  deleteMandate,
  getMandate,
  listMandates,
  updateMandate,
} from "../controllers/mandate.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  createMandateSchema,
  mandateListQuerySchema,
  updateMandateSchema,
} from "../validators/mandate.validators.js"

export const mandatesRouter = Router()

mandatesRouter.use(authenticate)

const canRead = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

mandatesRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(mandateListQuerySchema),
  asyncHandler(listMandates)
)

mandatesRouter.post(
  "/",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(createMandateSchema),
  asyncHandler(createMandate)
)

mandatesRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getMandate))

mandatesRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(updateMandateSchema),
  asyncHandler(updateMandate)
)

mandatesRouter.delete(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  asyncHandler(deleteMandate)
)
