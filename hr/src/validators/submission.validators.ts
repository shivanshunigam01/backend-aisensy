import { z } from "zod"

import {
  FIT_REASON_MAX_LENGTH,
  FIT_REASONS_MAX,
  OWNERSHIP_STATUSES,
  RISK_GAP_MAX_LENGTH,
  SUBMISSION_DUPLICATE_STATUSES,
  SUBMISSION_STATUSES,
} from "../constants/submissions.js"
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
    return value || null
  })

const optionalNumber = z.coerce.number().min(0).optional().nullable()

const submissionFields = z.object({
  candidateId: objectIdSchema,
  clientId: objectIdSchema.optional(),
  mandateId: objectIdSchema,
  evaluationId: optionalObjectId,
  submittedBy: objectIdSchema.optional(),
  submittedAt: optionalDateOnly,
  ownershipStartDate: optionalDateOnly,
  ownershipEndDate: optionalDateOnly,
  ownershipStatus: z.enum(OWNERSHIP_STATUSES).optional(),
  ownershipOverridden: z.boolean().optional(),
  clientAcknowledgement: z.boolean().optional(),
  acknowledgementDate: optionalDateOnly,
  duplicateStatus: z.enum(SUBMISSION_DUPLICATE_STATUSES).optional(),
  duplicateEvidence: z.string().trim().max(4000).optional().transform(emptyToUndefined),
  duplicateResolution: z.string().trim().max(4000).optional().transform(emptyToUndefined),
  fitReasons: z
    .array(z.string().trim().min(1).max(FIT_REASON_MAX_LENGTH))
    .max(FIT_REASONS_MAX)
    .optional(),
  risksGaps: z
    .array(z.string().trim().min(1).max(RISK_GAP_MAX_LENGTH))
    .max(10)
    .optional(),
  currentCompany: z.string().trim().max(160).optional().transform(emptyToUndefined),
  currentDesignation: z.string().trim().max(160).optional().transform(emptyToUndefined),
  currentLocation: z.string().trim().max(160).optional().transform(emptyToUndefined),
  totalExperience: optionalNumber,
  currentCTC: optionalNumber,
  expectedCTC: optionalNumber,
  noticePeriod: z.string().trim().max(40).optional().transform(emptyToUndefined),
  status: z.enum(SUBMISSION_STATUSES).optional(),
  remarks: z.string().trim().max(4000).optional().transform(emptyToUndefined),
})

function withOwnershipDates<T extends z.ZodType>(schema: T) {
  return schema.superRefine((value, ctx) => {
    const body = value as { ownershipStartDate?: string; ownershipEndDate?: string }
    if (
      body.ownershipStartDate &&
      body.ownershipEndDate &&
      body.ownershipEndDate < body.ownershipStartDate
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["ownershipEndDate"],
        message: "Ownership end date cannot be before the start date",
      })
    }
  })
}

export const createSubmissionSchema = withOwnershipDates(submissionFields)
export const updateSubmissionSchema = withOwnershipDates(submissionFields.partial())

export const submissionListQuerySchema = z.object({
  candidateId: objectIdSchema.optional(),
  clientId: objectIdSchema.optional(),
  mandateId: objectIdSchema.optional(),
  status: z.enum(SUBMISSION_STATUSES).optional(),
  duplicateStatus: z.enum(SUBMISSION_DUPLICATE_STATUSES).optional(),
  ...listControlFields(["submittedAt", "createdAt", "status"] as const),
})

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>
export type UpdateSubmissionInput = z.infer<typeof updateSubmissionSchema>
export type SubmissionListQueryInput = z.infer<typeof submissionListQuerySchema>
