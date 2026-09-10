import { z } from "zod"

import {
  AI_INTERVIEW_MODES,
  AI_INTERVIEW_RESULTS,
  AI_INTERVIEW_STATUSES,
} from "../constants/ai-interviews.js"
import { listControlFields } from "./list-query.js"
import { objectIdSchema } from "./organization.validators.js"

export const aiInterviewListQuerySchema = z.object({
  status: z.enum(AI_INTERVIEW_STATUSES).optional(),
  result: z.enum(AI_INTERVIEW_RESULTS).optional(),
  candidateId: objectIdSchema.optional(),
  jobId: objectIdSchema.optional(),
  ...listControlFields(["createdAt", "finalScore", "status"] as const),
})

export type AiInterviewListQueryInput = z.infer<typeof aiInterviewListQuerySchema>

export const submitAiInterviewAnswerSchema = z.object({
  questionOrder: z.coerce.number().int().min(1).max(20),
  answer: z.string().trim().min(1, "Answer is required").max(16000),
  answerMode: z.enum(["TEXT", "VOICE"]).optional(),
})

export type SubmitAiInterviewAnswerInput = z.infer<typeof submitAiInterviewAnswerSchema>

export const overrideAiInterviewResultSchema = z.object({
  result: z.enum(["PASSED", "FAILED"]),
  reason: z.string().trim().max(2000).optional(),
})

export type OverrideAiInterviewResultInput = z.infer<typeof overrideAiInterviewResultSchema>

export const updateAiInterviewConfigSchema = z.object({
  passingScore: z.coerce.number().int().min(0).max(100).optional(),
  interviewExpiryHours: z.coerce.number().int().min(1).max(720).optional(),
  autoTriggerOnApply: z.boolean().optional(),
  interviewMode: z.enum(AI_INTERVIEW_MODES).optional(),
})

export type UpdateAiInterviewConfigInput = z.infer<typeof updateAiInterviewConfigSchema>
