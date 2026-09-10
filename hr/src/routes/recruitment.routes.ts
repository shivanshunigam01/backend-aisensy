import { Router } from "express"

import {
  createApplication,
  createCandidate,
  createJob,
  deleteJob,
  getApplication,
  getBoard,
  getCandidate,
  getJob,
  listApplications,
  listCandidates,
  listJobs,
  updateApplication,
  updateCandidate,
  updateJob,
} from "../controllers/recruitment.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  applicationListQuerySchema,
  boardQuerySchema,
  candidateListQuerySchema,
  createApplicationSchema,
  createCandidateSchema,
  createJobSchema,
  jobListQuerySchema,
  updateApplicationSchema,
  updateCandidateSchema,
  updateJobSchema,
} from "../validators/recruitment.validators.js"

export const recruitmentRouter = Router()

recruitmentRouter.use(authenticate)

const canRead = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

recruitmentRouter.get(
  "/board",
  authorizePermissions(...canRead),
  validateQuery(boardQuerySchema),
  asyncHandler(getBoard)
)

recruitmentRouter.get(
  "/jobs",
  authorizePermissions(...canRead),
  validateQuery(jobListQuerySchema),
  asyncHandler(listJobs)
)

recruitmentRouter.post(
  "/jobs",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(createJobSchema),
  asyncHandler(createJob)
)

recruitmentRouter.get("/jobs/:id", authorizePermissions(...canRead), asyncHandler(getJob))

recruitmentRouter.patch(
  "/jobs/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(updateJobSchema),
  asyncHandler(updateJob)
)

recruitmentRouter.delete(
  "/jobs/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  asyncHandler(deleteJob)
)

recruitmentRouter.get(
  "/candidates",
  authorizePermissions(...canRead),
  validateQuery(candidateListQuerySchema),
  asyncHandler(listCandidates)
)

recruitmentRouter.post(
  "/candidates",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(createCandidateSchema),
  asyncHandler(createCandidate)
)

recruitmentRouter.get("/candidates/:id", authorizePermissions(...canRead), asyncHandler(getCandidate))

recruitmentRouter.patch(
  "/candidates/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(updateCandidateSchema),
  asyncHandler(updateCandidate)
)

recruitmentRouter.get(
  "/applications",
  authorizePermissions(...canRead),
  validateQuery(applicationListQuerySchema),
  asyncHandler(listApplications)
)

recruitmentRouter.post(
  "/applications",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(createApplicationSchema),
  asyncHandler(createApplication)
)

recruitmentRouter.get(
  "/applications/:id",
  authorizePermissions(...canRead),
  asyncHandler(getApplication)
)

recruitmentRouter.patch(
  "/applications/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(updateApplicationSchema),
  asyncHandler(updateApplication)
)
