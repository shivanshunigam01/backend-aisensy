import { z } from "zod"

import { DOCUMENT_STATUSES, DOCUMENT_TYPES } from "../constants/documents.js"
import { listControlFields } from "./list-query.js"
import { objectIdSchema } from "./organization.validators.js"

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")

const emptyToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export const uploadDocumentSchema = z.object({
  employeeId: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    objectIdSchema.optional()
  ),
  name: z.string().trim().max(160).optional().transform(emptyToUndefined),
  type: z.enum(DOCUMENT_TYPES),
  expiryDate: z
    .string()
    .trim()
    .optional()
    .transform(emptyToUndefined)
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: "Use YYYY-MM-DD",
    }),
})

export const updateDocumentSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  type: z.enum(DOCUMENT_TYPES).optional(),
  expiryDate: z
    .union([dateOnlySchema, z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === "" ? null : value)),
})

export const documentListQuerySchema = z.object({
  employeeId: objectIdSchema.optional(),
  type: z.enum(DOCUMENT_TYPES).optional(),
  status: z.enum(DOCUMENT_STATUSES).optional(),
  ...listControlFields(["uploadedAt", "createdAt", "name", "type"] as const, 12),
})

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>
export type DocumentListQueryInput = z.infer<typeof documentListQuerySchema>
