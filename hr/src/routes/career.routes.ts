import { Router } from "express"

import { applyToCareerJob, getCareerJob, listCareerJobs } from "../controllers/career.controller.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { careersApplyLimiter } from "../middleware/rate-limit.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  careersListQuerySchema,
  publicApplySchema,
} from "../validators/career.validators.js"

export const careersRouter = Router()

careersRouter.get(
  "/:orgSlug",
  validateQuery(careersListQuerySchema),
  asyncHandler(listCareerJobs)
)

careersRouter.get("/:orgSlug/jobs/:jobId", asyncHandler(getCareerJob))

careersRouter.post(
  "/:orgSlug/jobs/:jobId/apply",
  careersApplyLimiter,
  validateBody(publicApplySchema),
  asyncHandler(applyToCareerJob)
)
