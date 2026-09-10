import { z } from "zod"

import {
  AGREEMENT_FEE_TYPES,
  AGREEMENT_STATUSES,
} from "../constants/agreements.js"
import { GST_SPLIT_MODES } from "../constants/invoices.js"
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

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname)
  } catch {
    return false
  }
}

const signedDocumentUrlMessage = "Enter a signed document URL starting with http:// or https://"

const signedDocumentObject = z.object({
  fileUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => isHttpUrl(value), {
      message: signedDocumentUrlMessage,
    }),
  fileName: z.string().trim().max(200).optional().transform(emptyToUndefined),
})

const signedDocumentSchema = z
  .union([
    z
      .string()
      .trim()
      .max(500)
      .transform((value) => (value ? value : undefined)),
    signedDocumentObject,
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
    (value) => value === undefined || value === null || isHttpUrl(value.fileUrl),
    { message: signedDocumentUrlMessage }
  )

const commercialTermsSchema = z.object({
  recruitmentFee: z.coerce.number().min(0).optional(),
  feeType: z.enum(AGREEMENT_FEE_TYPES).optional(),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).optional(),
  gstRatePercent: z.coerce.number().min(0).max(100).optional(),
  gstSplitMode: z.enum(GST_SPLIT_MODES).optional(),
})

const agreementFields = z.object({
  clientId: objectIdSchema,
  effectiveDate: dateOnlySchema,
  expiryDate: optionalDateOnly,
  signedDate: optionalDateOnly,
  commercialTerms: commercialTermsSchema.optional(),
  ownershipPeriodMonths: z.coerce.number().int().min(0).max(120).optional(),
  duplicateNotificationDays: z.coerce.number().int().min(0).max(365).optional(),
  replacementPeriodDays: z.coerce.number().int().min(0).max(730).optional(),
  status: z.enum(AGREEMENT_STATUSES).optional(),
  signedDocument: signedDocumentSchema,
})

function withAgreementRules<T extends z.ZodType>(schema: T) {
  return schema.superRefine((value, ctx) => {
    const body = value as {
      feeType?: string
      commercialTerms?: { feeType?: string; recruitmentFee?: number }
      effectiveDate?: string
      expiryDate?: string
      signedDate?: string
      status?: string
    }

    const feeType = body.commercialTerms?.feeType
    const recruitmentFee = body.commercialTerms?.recruitmentFee
    if (feeType === "PERCENTAGE" && recruitmentFee !== undefined && recruitmentFee > 100) {
      ctx.addIssue({
        code: "custom",
        message: "Percentage fee cannot exceed 100",
        path: ["commercialTerms", "recruitmentFee"],
      })
    }

    if (body.effectiveDate && body.expiryDate && body.expiryDate < body.effectiveDate) {
      ctx.addIssue({
        code: "custom",
        message: "Expiry date must be on or after the effective date",
        path: ["expiryDate"],
      })
    }

    if (body.signedDate && body.effectiveDate && body.signedDate < body.effectiveDate) {
      ctx.addIssue({
        code: "custom",
        message: "Signed date cannot be before the effective date",
        path: ["signedDate"],
      })
    }
  })
}

export const createAgreementSchema = withAgreementRules(agreementFields)
export const updateAgreementSchema = withAgreementRules(agreementFields.partial())

export const agreementListQuerySchema = z.object({
  status: z.enum(AGREEMENT_STATUSES).optional(),
  clientId: objectIdSchema.optional(),
  ...listControlFields(["createdAt", "agreementNumber", "status", "effectiveDate"] as const),
})

export type CreateAgreementInput = z.infer<typeof createAgreementSchema>
export type UpdateAgreementInput = z.infer<typeof updateAgreementSchema>
export type AgreementListQueryInput = z.infer<typeof agreementListQuerySchema>
