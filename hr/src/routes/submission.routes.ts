import { Router } from "express"

import {
  createSubmission,
  deleteSubmission,
  getSubmission,
  listSubmissions,
  updateSubmission,
} from "../controllers/submission.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  createSubmissionSchema,
  submissionListQuerySchema,
  updateSubmissionSchema,
} from "../validators/submission.validators.js"

export const submissionsRouter = Router()

submissionsRouter.use(authenticate)

const canRead = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

submissionsRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(submissionListQuerySchema),
  asyncHandler(listSubmissions)
)

submissionsRouter.post(
  "/",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(createSubmissionSchema),
  asyncHandler(createSubmission)
)

submissionsRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getSubmission))

submissionsRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(updateSubmissionSchema),
  asyncHandler(updateSubmission)
)

submissionsRouter.delete(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  asyncHandler(deleteSubmission)
)
