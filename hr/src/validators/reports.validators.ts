import { z } from "zod"

import { objectIdSchema } from "./organization.validators.js"

const dateKeySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")

export const reportQuerySchema = z
  .object({
    from: dateKeySchema.optional(),
    to: dateKeySchema.optional(),
    departmentId: objectIdSchema.optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "Start date must be on or before the end date",
    path: ["to"],
  })

export type ReportQueryInput = z.infer<typeof reportQuerySchema>
