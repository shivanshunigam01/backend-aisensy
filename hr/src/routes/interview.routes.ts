import { Router } from "express"

import {
  createInterview,
  deleteInterview,
  getInterview,
  listInterviews,
  updateInterview,
} from "../controllers/interview.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  createInterviewSchema,
  interviewListQuerySchema,
  updateInterviewSchema,
} from "../validators/interview.validators.js"

export const interviewsRouter = Router()

interviewsRouter.use(authenticate)

const canRead = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

interviewsRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(interviewListQuerySchema),
  asyncHandler(listInterviews)
)

interviewsRouter.post(
  "/",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(createInterviewSchema),
  asyncHandler(createInterview)
)

interviewsRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getInterview))

interviewsRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(updateInterviewSchema),
  asyncHandler(updateInterview)
)

interviewsRouter.delete(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  asyncHandler(deleteInterview)
)
