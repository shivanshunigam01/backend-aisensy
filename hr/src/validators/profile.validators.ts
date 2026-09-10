import { z } from "zod"

import { addressSchema } from "./organization.validators.js"

const emptyToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform(emptyToUndefined)

const profileImageSchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform(emptyToUndefined)
  .refine((value) => !value || /^https?:\/\//i.test(value) || value.startsWith("/"), {
    message: "Enter a valid image URL",
  })

export const updateOwnProfileSchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name").max(80).optional(),
  lastName: z.string().trim().max(80).optional().transform(emptyToUndefined),
  phone: optionalText(30),
  profileImage: profileImageSchema,
  address: addressSchema.optional(),
})

export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>
