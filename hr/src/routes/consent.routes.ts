import { Router } from "express"

import {
  createConsent,
  deleteConsent,
  getConsent,
  listConsents,
  updateConsent,
} from "../controllers/consent.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  consentListQuerySchema,
  createConsentSchema,
  updateConsentSchema,
} from "../validators/consent.validators.js"

export const consentsRouter = Router()

consentsRouter.use(authenticate)

const canRead = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

consentsRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(consentListQuerySchema),
  asyncHandler(listConsents)
)

consentsRouter.post(
  "/",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(createConsentSchema),
  asyncHandler(createConsent)
)

consentsRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getConsent))

consentsRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(updateConsentSchema),
  asyncHandler(updateConsent)
)

consentsRouter.delete(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  asyncHandler(deleteConsent)
)
