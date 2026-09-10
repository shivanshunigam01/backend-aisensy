import { z } from "zod"

import { objectIdSchema } from "./organization.validators.js"

const dateKeySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")

const optionalDateKey = z
  .union([dateKeySchema, z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined))

export const recruitmentDashboardQuerySchema = z
  .object({
    from: optionalDateKey,
    to: optionalDateKey,
    clientId: objectIdSchema.optional(),
    recruiterId: objectIdSchema.optional(),
    mandateId: objectIdSchema.optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "Start date must be on or before the end date",
    path: ["to"],
  })

export type RecruitmentDashboardQueryInput = z.infer<typeof recruitmentDashboardQuerySchema>
