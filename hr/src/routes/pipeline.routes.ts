import { Router } from "express"

import {
  getMandatePipeline,
  transitionPipelineStage,
} from "../controllers/pipeline.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  pipelineListQuerySchema,
  pipelineTransitionSchema,
} from "../validators/pipeline.validators.js"

export const pipelineRouter = Router()

pipelineRouter.use(authenticate)

const canRead = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

pipelineRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(pipelineListQuerySchema),
  asyncHandler(getMandatePipeline)
)

pipelineRouter.post(
  "/transition",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(pipelineTransitionSchema),
  asyncHandler(transitionPipelineStage)
)
