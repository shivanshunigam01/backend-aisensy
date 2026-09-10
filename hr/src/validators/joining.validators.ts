import { z } from "zod"

import { JOINING_CONFIRMATION_STATUSES } from "../constants/joinings.js"
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

export const createJoiningSchema = z.object({
  candidateId: optionalObjectId,
  mandateId: optionalObjectId,
  offerId: objectIdSchema,
  clientId: optionalObjectId,
  joiningDate: dateOnlySchema.optional(),
  status: z.enum(JOINING_CONFIRMATION_STATUSES).optional(),
  confirmedBy: optionalObjectId,
  confirmationDate: optionalDateOnly,
  remarks: z.string().trim().max(4000).optional().transform(emptyToUndefined),
})

export const updateJoiningSchema = createJoiningSchema.partial().extend({
  offerId: objectIdSchema.optional(),
})

export const joiningListQuerySchema = z.object({
  candidateId: objectIdSchema.optional(),
  mandateId: objectIdSchema.optional(),
  offerId: objectIdSchema.optional(),
  clientId: objectIdSchema.optional(),
  status: z.enum(JOINING_CONFIRMATION_STATUSES).optional(),
  ...listControlFields(["joiningDate", "createdAt", "status"] as const),
})

export type CreateJoiningInput = z.infer<typeof createJoiningSchema>
export type UpdateJoiningInput = z.infer<typeof updateJoiningSchema>
export type JoiningListQueryInput = z.infer<typeof joiningListQuerySchema>
