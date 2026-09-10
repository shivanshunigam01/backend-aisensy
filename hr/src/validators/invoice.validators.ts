import { z } from "zod"

import { GST_SPLIT_MODES, INVOICE_STATUSES } from "../constants/invoices.js"
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

export const createInvoiceSchema = z.object({
  clientId: optionalObjectId,
  joiningId: optionalObjectId,
  invoiceDate: dateOnlySchema.optional(),
  dueDate: optionalDateOnly,
  professionalFee: z.coerce.number().min(0).optional(),
  gstRatePercent: z.coerce.number().min(0).max(100).optional(),
  gstSplitMode: z.enum(GST_SPLIT_MODES).optional(),
  amount: z.coerce.number().min(0).optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  remarks: z.string().trim().max(4000).optional().transform(emptyToUndefined),
})

export const updateInvoiceSchema = createInvoiceSchema.partial().extend({
  amount: z.coerce.number().min(0).optional(),
  professionalFee: z.coerce.number().min(0).optional(),
})

export const invoiceListQuerySchema = z.object({
  clientId: objectIdSchema.optional(),
  joiningId: objectIdSchema.optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  ...listControlFields(["invoiceDate", "createdAt", "amount", "status", "invoiceNumber"] as const),
})

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>
export type InvoiceListQueryInput = z.infer<typeof invoiceListQuerySchema>
