import { z } from "zod"

import { REPLACEMENT_REASONS, REPLACEMENT_STATUSES } from "../constants/replacements.js"
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

const exclusionsSchema = z
  .object({
    salaryDelayed: z.boolean().optional(),
    roleChanged: z.boolean().optional(),
    locationChanged: z.boolean().optional(),
    compensationChanged: z.boolean().optional(),
    retrenchment: z.boolean().optional(),
    redundancy: z.boolean().optional(),
    businessClosure: z.boolean().optional(),
    restructuring: z.boolean().optional(),
    unsafeConditions: z.boolean().optional(),
    clientMisconduct: z.boolean().optional(),
  })
  .optional()

const replacementFields = z.object({
  candidateId: optionalObjectId,
  mandateId: optionalObjectId,
  clientId: optionalObjectId,
  joiningId: objectIdSchema,
  replacementReason: z.enum(REPLACEMENT_REASONS),
  replacementRequestedDate: dateOnlySchema.optional(),
  status: z.enum(REPLACEMENT_STATUSES).optional(),
  replacementCandidateId: optionalObjectId,
  closedAt: optionalDateOnly,
  exclusions: exclusionsSchema,
  manualOverride: z.boolean().optional(),
  remarks: z.string().trim().max(4000).optional().transform(emptyToUndefined),
})

function withReplacementRules<T extends z.ZodType>(schema: T) {
  return schema.superRefine((value, ctx) => {
    const body = value as { status?: string; replacementCandidateId?: string }
    if (body.status === "REPLACED" && !body.replacementCandidateId) {
      ctx.addIssue({
        code: "custom",
        path: ["replacementCandidateId"],
        message: "Select the replacement candidate",
      })
    }
  })
}

export const createReplacementSchema = withReplacementRules(replacementFields)
export const updateReplacementSchema = withReplacementRules(
  replacementFields.partial().extend({
    joiningId: objectIdSchema.optional(),
    replacementReason: z.enum(REPLACEMENT_REASONS).optional(),
  })
)

export const replacementListQuerySchema = z.object({
  candidateId: objectIdSchema.optional(),
  mandateId: objectIdSchema.optional(),
  clientId: objectIdSchema.optional(),
  joiningId: objectIdSchema.optional(),
  status: z.enum(REPLACEMENT_STATUSES).optional(),
  ...listControlFields(["replacementRequestedDate", "createdAt", "status"] as const),
})

export type CreateReplacementInput = z.infer<typeof createReplacementSchema>
export type UpdateReplacementInput = z.infer<typeof updateReplacementSchema>
export type ReplacementListQueryInput = z.infer<typeof replacementListQuerySchema>
