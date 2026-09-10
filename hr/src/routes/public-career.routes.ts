import { Router } from "express"

import {
  applyToPublicCareer,
  getPublicCareer,
  listPublicCareers,
} from "../controllers/public-career.controller.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { careersApplyLimiter } from "../middleware/rate-limit.js"
import { optionalDocumentFileUpload } from "../middleware/upload.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  publicCareerApplySchema,
  publicCareerListQuerySchema,
} from "../validators/public-career.validators.js"

export const publicCareersRouter = Router()

publicCareersRouter.get(
  "/",
  validateQuery(publicCareerListQuerySchema),
  asyncHandler(listPublicCareers)
)

publicCareersRouter.get("/:mandateId", asyncHandler(getPublicCareer))

publicCareersRouter.post(
  "/:mandateId/apply",
  careersApplyLimiter,
  optionalDocumentFileUpload,
  validateBody(publicCareerApplySchema),
  asyncHandler(applyToPublicCareer)
)
