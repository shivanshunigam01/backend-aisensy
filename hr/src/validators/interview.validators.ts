import { z } from "zod"

import {
  INTERVIEW_DECISIONS,
  INTERVIEW_DURATION_MAX,
  INTERVIEW_DURATION_MIN,
  INTERVIEW_SCORE_MAX,
  INTERVIEW_SCORE_MIN,
  INTERVIEW_STATUSES,
  INTERVIEW_TYPES,
} from "../constants/interviews.js"
import { listControlFields } from "./list-query.js"
import { objectIdSchema } from "./organization.validators.js"

const emptyToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const dateTimeSchema = z
  .string()
  .trim()
  .min(1, "Scheduled time is required")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date and time")

const optionalDateTime = z
  .union([dateTimeSchema, z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined))

const score = z.coerce.number().min(INTERVIEW_SCORE_MIN).max(INTERVIEW_SCORE_MAX)

const feedbackSchema = z.object({
  technicalScore: score.optional(),
  communicationScore: score.optional(),
  cultureFitScore: score.optional(),
  leadershipScore: score.optional(),
  compensationFit: score.optional(),
  joiningRisk: score.optional(),
  comments: z.string().trim().max(4000).optional().transform(emptyToUndefined),
})

const optionalObjectId = z
  .union([objectIdSchema, z.literal(""), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined
    return value || undefined
  })

export const createInterviewSchema = z.object({
  candidateId: optionalObjectId,
  mandateId: optionalObjectId,
  submissionId: objectIdSchema,
  round: z.coerce.number().int().min(1).max(20).optional(),
  interviewType: z.enum(INTERVIEW_TYPES).optional(),
  scheduledAt: dateTimeSchema,
  duration: z.coerce
    .number()
    .int()
    .min(INTERVIEW_DURATION_MIN)
    .max(INTERVIEW_DURATION_MAX)
    .optional(),
  interviewers: z.array(objectIdSchema).max(20).optional(),
  status: z.enum(INTERVIEW_STATUSES).optional(),
  feedback: feedbackSchema.optional(),
  decision: z.union([z.enum(INTERVIEW_DECISIONS), z.literal("")]).optional(),
  nextAction: z.string().trim().max(500).optional().transform(emptyToUndefined),
  nextActionDeadline: z
    .union([
      z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
      z.literal(""),
    ])
    .optional()
    .transform((value) => (value ? value : undefined)),
})

export const updateInterviewSchema = createInterviewSchema.partial().extend({
  submissionId: objectIdSchema.optional(),
  scheduledAt: optionalDateTime,
  feedback: feedbackSchema.partial().optional(),
})

export const interviewListQuerySchema = z.object({
  candidateId: objectIdSchema.optional(),
  mandateId: objectIdSchema.optional(),
  submissionId: objectIdSchema.optional(),
  status: z.enum(INTERVIEW_STATUSES).optional(),
  interviewType: z.enum(INTERVIEW_TYPES).optional(),
  ...listControlFields(["scheduledAt", "createdAt", "status"] as const),
})

export type CreateInterviewInput = z.infer<typeof createInterviewSchema>
export type UpdateInterviewInput = z.infer<typeof updateInterviewSchema>
export type InterviewListQueryInput = z.infer<typeof interviewListQuerySchema>
