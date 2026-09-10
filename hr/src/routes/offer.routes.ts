import { Router } from "express"

import {
  createOffer,
  deleteOffer,
  getOffer,
  listOffers,
  updateOffer,
} from "../controllers/offer.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  createOfferSchema,
  offerListQuerySchema,
  updateOfferSchema,
} from "../validators/offer.validators.js"

export const offersRouter = Router()

offersRouter.use(authenticate)

const canRead = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

offersRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(offerListQuerySchema),
  asyncHandler(listOffers)
)

offersRouter.post(
  "/",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(createOfferSchema),
  asyncHandler(createOffer)
)

offersRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getOffer))

offersRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(updateOfferSchema),
  asyncHandler(updateOffer)
)

offersRouter.delete(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  asyncHandler(deleteOffer)
)
