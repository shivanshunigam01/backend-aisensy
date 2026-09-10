import { Router } from "express"

import {
  getJobApplication,
  listJobApplications,
  updateJobApplication,
} from "../controllers/job-application.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  jobApplicationListQuerySchema,
  updateJobApplicationSchema,
} from "../validators/public-career.validators.js"

export const jobApplicationsRouter = Router()

jobApplicationsRouter.use(authenticate)

const canRead = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

jobApplicationsRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(jobApplicationListQuerySchema),
  asyncHandler(listJobApplications)
)

jobApplicationsRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getJobApplication))

jobApplicationsRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(updateJobApplicationSchema),
  asyncHandler(updateJobApplication)
)
