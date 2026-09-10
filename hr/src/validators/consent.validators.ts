import { z } from "zod"

import {
  CANDIDATE_CONSENT_METHODS,
  CANDIDATE_CONSENT_PURPOSES,
} from "../constants/candidates.js"
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

const consentDocumentObject = z.object({
  fileUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => /^https?:\/\//i.test(value), {
      message: "Enter a document URL starting with http:// or https://",
    }),
  fileName: z.string().trim().max(200).optional().transform(emptyToUndefined),
})

const consentDocumentSchema = z
  .union([
    z
      .string()
      .trim()
      .max(500)
      .transform((value) => (value ? value : undefined)),
    consentDocumentObject,
    z.null(),
  ])
  .optional()
  .transform((value) => {
    if (value === null) return null
    if (!value) return undefined
    if (typeof value === "string") {
      return { fileUrl: value, fileName: undefined as string | undefined }
    }
    return value
  })
  .refine(
    (value) =>
      value === undefined ||
      value === null ||
      /^https?:\/\//i.test(value.fileUrl),
    { message: "Enter a document URL starting with http:// or https://" }
  )

export const createConsentSchema = z.object({
  candidateId: objectIdSchema,
  mandateId: objectIdSchema,
  consentGiven: z.boolean().optional(),
  consentDate: optionalDateOnly,
  consentMethod: z.enum(CANDIDATE_CONSENT_METHODS).optional(),
  consentPurpose: z.enum(CANDIDATE_CONSENT_PURPOSES).optional(),
  consentDocument: consentDocumentSchema,
  expiryDate: optionalDateOnly,
})

export const updateConsentSchema = createConsentSchema.partial().extend({
  withdrawnAt: optionalDateOnly.nullable(),
})

export const consentListQuerySchema = z.object({
  candidateId: objectIdSchema.optional(),
  mandateId: objectIdSchema.optional(),
  consentGiven: z.enum(["true", "false"]).optional(),
  ...listControlFields(["createdAt", "consentDate", "consentPurpose"] as const),
})

export type CreateConsentInput = z.infer<typeof createConsentSchema>
export type UpdateConsentInput = z.infer<typeof updateConsentSchema>
export type ConsentListQueryInput = z.infer<typeof consentListQuerySchema>
