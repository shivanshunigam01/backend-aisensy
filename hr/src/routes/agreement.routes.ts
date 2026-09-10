import { Router } from "express"

import {
  createAgreement,
  deleteAgreement,
  getAgreement,
  listAgreements,
  updateAgreement,
} from "../controllers/agreement.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  agreementListQuerySchema,
  createAgreementSchema,
  updateAgreementSchema,
} from "../validators/agreement.validators.js"

export const agreementsRouter = Router()

agreementsRouter.use(authenticate)

const canRead = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

agreementsRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(agreementListQuerySchema),
  asyncHandler(listAgreements)
)

agreementsRouter.post(
  "/",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(createAgreementSchema),
  asyncHandler(createAgreement)
)

agreementsRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getAgreement))

agreementsRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(updateAgreementSchema),
  asyncHandler(updateAgreement)
)

agreementsRouter.delete(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  asyncHandler(deleteAgreement)
)
