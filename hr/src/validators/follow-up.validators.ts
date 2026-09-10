import { z } from "zod"

import {
  FOLLOW_UP_CANDIDATE_STATUSES,
  FOLLOW_UP_RISK_LEVELS,
  FOLLOW_UP_TYPES,
  JOINING_PROBABILITY_MAX,
  JOINING_PROBABILITY_MIN,
} from "../constants/follow-ups.js"
import { listControlFields } from "./list-query.js"
import { objectIdSchema } from "./organization.validators.js"

const emptyToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")

const optionalDateOnly = z
  .union([dateOnlySchema, z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined))

const optionalObjectId = z
  .union([objectIdSchema, z.literal(""), z.null()])
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined
    return value || undefined
  })

const followUpFields = z.object({
  candidateId: optionalObjectId,
  offerId: objectIdSchema,
  followUpDate: dateOnlySchema.optional(),
  followUpType: z.enum(FOLLOW_UP_TYPES).optional(),
  candidateStatus: z.enum(FOLLOW_UP_CANDIDATE_STATUSES).optional(),
  joiningProbability: z.coerce
    .number()
    .min(JOINING_PROBABILITY_MIN)
    .max(JOINING_PROBABILITY_MAX)
    .optional(),
  riskLevel: z.enum(FOLLOW_UP_RISK_LEVELS).optional(),
  remarks: z.string().trim().max(4000).optional().transform(emptyToUndefined),
  nextFollowUpDate: optionalDateOnly,
  createdBy: objectIdSchema.optional(),
})

function withFollowUpDates<T extends z.ZodType>(schema: T) {
  return schema.superRefine((value, ctx) => {
    const body = value as { followUpDate?: string; nextFollowUpDate?: string }
    if (body.followUpDate && body.nextFollowUpDate && body.nextFollowUpDate < body.followUpDate) {
      ctx.addIssue({
        code: "custom",
        path: ["nextFollowUpDate"],
        message: "Next follow-up cannot be before this follow-up date",
      })
    }
  })
}

export const createFollowUpSchema = withFollowUpDates(followUpFields)
export const updateFollowUpSchema = withFollowUpDates(
  followUpFields.partial().extend({
    offerId: objectIdSchema.optional(),
  })
)

export const followUpListQuerySchema = z.object({
  candidateId: objectIdSchema.optional(),
  offerId: objectIdSchema.optional(),
  followUpType: z.enum(FOLLOW_UP_TYPES).optional(),
  riskLevel: z.enum(FOLLOW_UP_RISK_LEVELS).optional(),
  candidateStatus: z.enum(FOLLOW_UP_CANDIDATE_STATUSES).optional(),
  ...listControlFields(["followUpDate", "createdAt", "riskLevel"] as const),
})

export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>
export type UpdateFollowUpInput = z.infer<typeof updateFollowUpSchema>
export type FollowUpListQueryInput = z.infer<typeof followUpListQuerySchema>
