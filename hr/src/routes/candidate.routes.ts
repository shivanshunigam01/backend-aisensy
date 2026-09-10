import { Router } from "express"

import {
  createCandidate,
  deleteCandidate,
  getCandidate,
  listCandidates,
  updateCandidate,
} from "../controllers/candidate.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  candidateProfileListQuerySchema,
  createCandidateProfileSchema,
  updateCandidateProfileSchema,
} from "../validators/candidate.validators.js"

export const candidatesRouter = Router()

candidatesRouter.use(authenticate)

const canRead = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

candidatesRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(candidateProfileListQuerySchema),
  asyncHandler(listCandidates)
)

candidatesRouter.post(
  "/",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(createCandidateProfileSchema),
  asyncHandler(createCandidate)
)

candidatesRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getCandidate))

candidatesRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(updateCandidateProfileSchema),
  asyncHandler(updateCandidate)
)

candidatesRouter.delete(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  asyncHandler(deleteCandidate)
)
