import { z } from "zod"

import { PAYMENT_METHODS, PAYMENT_STATUSES } from "../constants/payments.js"
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

export const createPaymentSchema = z.object({
  invoiceId: objectIdSchema,
  amount: z.coerce.number().gt(0, "Enter a payment amount"),
  paymentDate: dateOnlySchema.optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  transactionReference: z.string().trim().max(120).optional().transform(emptyToUndefined),
  status: z.enum(PAYMENT_STATUSES).optional(),
  remarks: z.string().trim().max(4000).optional().transform(emptyToUndefined),
})

export const updatePaymentSchema = createPaymentSchema.partial().extend({
  invoiceId: objectIdSchema.optional(),
  amount: z.coerce.number().gt(0, "Enter a payment amount").optional(),
})

export const paymentListQuerySchema = z.object({
  invoiceId: objectIdSchema.optional(),
  status: z.enum(PAYMENT_STATUSES).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  ...listControlFields(["paymentDate", "createdAt", "amount", "status"] as const),
})

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>
export type PaymentListQueryInput = z.infer<typeof paymentListQuerySchema>
