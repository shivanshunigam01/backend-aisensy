import { z } from "zod"

import { JOINING_STATUSES, OFFER_STATUSES } from "../constants/offers.js"
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

export const createOfferSchema = z.object({
  candidateId: optionalObjectId,
  mandateId: optionalObjectId,
  submissionId: objectIdSchema,
  selectedDate: optionalDateOnly,
  offeredDesignation: z.string().trim().min(1, "Enter the offered designation").max(160),
  offeredCTC: z.coerce.number().min(0),
  offerDate: optionalDateOnly,
  offerStatus: z.enum(OFFER_STATUSES).optional(),
  expectedJoiningDate: optionalDateOnly,
  actualJoiningDate: optionalDateOnly,
  joiningStatus: z.enum(JOINING_STATUSES).optional(),
  remarks: z.string().trim().max(4000).optional().transform(emptyToUndefined),
})

export const updateOfferSchema = createOfferSchema.partial().extend({
  submissionId: objectIdSchema.optional(),
  offeredDesignation: z.string().trim().min(1).max(160).optional(),
  offeredCTC: z.coerce.number().min(0).optional(),
})

export const offerListQuerySchema = z.object({
  candidateId: objectIdSchema.optional(),
  mandateId: objectIdSchema.optional(),
  submissionId: objectIdSchema.optional(),
  offerStatus: z.enum(OFFER_STATUSES).optional(),
  joiningStatus: z.enum(JOINING_STATUSES).optional(),
  ...listControlFields(["offerDate", "createdAt", "offerStatus"] as const),
})

export type CreateOfferInput = z.infer<typeof createOfferSchema>
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>
export type OfferListQueryInput = z.infer<typeof offerListQuerySchema>
