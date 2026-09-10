import { Router } from "express"

import {
  createEvaluation,
  deleteEvaluation,
  getEvaluation,
  listEvaluations,
  updateEvaluation,
} from "../controllers/evaluation.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  createEvaluationSchema,
  evaluationListQuerySchema,
  updateEvaluationSchema,
} from "../validators/evaluation.validators.js"

export const evaluationsRouter = Router()

evaluationsRouter.use(authenticate)

const canRead = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

evaluationsRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(evaluationListQuerySchema),
  asyncHandler(listEvaluations)
)

evaluationsRouter.post(
  "/",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(createEvaluationSchema),
  asyncHandler(createEvaluation)
)

evaluationsRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getEvaluation))

evaluationsRouter.patch(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(updateEvaluationSchema),
  asyncHandler(updateEvaluation)
)

evaluationsRouter.delete(
  "/:id",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  asyncHandler(deleteEvaluation)
)
