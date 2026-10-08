import { z } from "zod"

import { PIPELINE_STAGES } from "../constants/pipeline.js"
import { listControlFields } from "./list-query.js"
import { objectIdSchema } from "./organization.validators.js"

export const pipelineListQuerySchema = z.object({
  mandateId: objectIdSchema.optional(),
  recruiterId: objectIdSchema.optional(),
  stage: z.enum(PIPELINE_STAGES).optional(),
  ...listControlFields(["createdAt"] as const, 50),
})

export const pipelineTransitionSchema = z.object({
  candidateId: objectIdSchema,
  mandateId: objectIdSchema,
  targetStage: z.enum(PIPELINE_STAGES),
})

export type PipelineListQueryInput = z.infer<typeof pipelineListQuerySchema>
export type PipelineTransitionInput = z.infer<typeof pipelineTransitionSchema>
