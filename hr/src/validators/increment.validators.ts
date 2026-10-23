import { z } from "zod"

import { objectIdSchema } from "./organization.validators.js"

export const incrementWorksheetQuerySchema = z.object({
  reviewPeriod: z
    .string()
    .trim()
    .regex(/^\d{4}-Q[1-4]$/, "Use a review period like 2026-Q1"),
})

const incrementLineSchema = z.object({
  employeeId: objectIdSchema,
  incrementPercent: z.coerce.number().min(0).max(100),
  note: z.string().trim().max(500).optional(),
})

export const applyIncrementsSchema = z.object({
  reviewPeriod: incrementWorksheetQuerySchema.shape.reviewPeriod,
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.array(incrementLineSchema).min(1).max(500),
})

export type IncrementWorksheetQueryInput = z.infer<typeof incrementWorksheetQuerySchema>
export type ApplyIncrementsInput = z.infer<typeof applyIncrementsSchema>
