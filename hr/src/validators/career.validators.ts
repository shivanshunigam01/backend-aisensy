import { z } from "zod"

import { listControlFields } from "./list-query.js"
import { objectIdSchema } from "./organization.validators.js"

const emptyToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export const careersListQuerySchema = z.object({
  ...listControlFields(["createdAt", "title"] as const, 50),
})

export const publicApplySchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.email("Enter a valid email"),
  phone: z.string().trim().max(30).optional().transform(emptyToUndefined),
  resume: z.string().trim().max(500).optional().transform(emptyToUndefined),
  experience: z.coerce.number().min(0).max(50).optional().default(0),
  skills: z
    .array(z.string().trim().min(1).max(40))
    .max(20)
    .optional()
    .default([]),
  notes: z.string().trim().max(4000).optional().transform(emptyToUndefined),
  consent: z.boolean().refine((value) => value === true, {
    message: "Consent is required to apply",
  }),
})

export type CareersListQueryInput = z.infer<typeof careersListQuerySchema>
export type PublicApplyInput = z.infer<typeof publicApplySchema>
