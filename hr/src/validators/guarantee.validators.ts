import { z } from "zod"

import {
  GUARANTEE_MILESTONE_STATUSES,
  RETENTION_STATUSES,
} from "../constants/guarantees.js"
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

const milestoneSchema = z.object({
  status: z.enum(GUARANTEE_MILESTONE_STATUSES).optional(),
  completedAt: optionalDateOnly,
  clientFeedback: z.string().trim().max(4000).optional().transform(emptyToUndefined),
  candidateFeedback: z.string().trim().max(4000).optional().transform(emptyToUndefined),
})

const guaranteeFields = z.object({
  candidateId: optionalObjectId,
  joiningId: objectIdSchema,
  mandateId: optionalObjectId,
  clientId: optionalObjectId,
  joiningDate: dateOnlySchema.optional(),
  guaranteeStartDate: dateOnlySchema.optional(),
  guaranteeEndDate: dateOnlySchema.optional(),
  milestone30: milestoneSchema.optional(),
  milestone60: milestoneSchema.optional(),
  milestone90: milestoneSchema.optional(),
  retentionStatus: z.enum(RETENTION_STATUSES).optional(),
})

function withGuaranteeDates<T extends z.ZodType>(schema: T) {
  return schema.superRefine((value, ctx) => {
    const body = value as {
      guaranteeStartDate?: string
      joiningDate?: string
      guaranteeEndDate?: string
    }
    const start = body.guaranteeStartDate ?? body.joiningDate
    if (start && body.guaranteeEndDate && body.guaranteeEndDate < start) {
      ctx.addIssue({
        code: "custom",
        path: ["guaranteeEndDate"],
        message: "Guarantee end date cannot be before the start date",
      })
    }
  })
}

export const createGuaranteeSchema = withGuaranteeDates(guaranteeFields)
export const updateGuaranteeSchema = withGuaranteeDates(
  guaranteeFields.partial().extend({
    joiningId: objectIdSchema.optional(),
  })
)

export const guaranteeListQuerySchema = z.object({
  candidateId: objectIdSchema.optional(),
  joiningId: objectIdSchema.optional(),
  mandateId: objectIdSchema.optional(),
  clientId: objectIdSchema.optional(),
  retentionStatus: z.enum(RETENTION_STATUSES).optional(),
  ...listControlFields(["guaranteeEndDate", "createdAt", "retentionStatus"] as const),
})

export type CreateGuaranteeInput = z.infer<typeof createGuaranteeSchema>
export type UpdateGuaranteeInput = z.infer<typeof updateGuaranteeSchema>
export type GuaranteeListQueryInput = z.infer<typeof guaranteeListQuerySchema>
export type GuaranteeMilestoneInput = z.infer<typeof milestoneSchema>
