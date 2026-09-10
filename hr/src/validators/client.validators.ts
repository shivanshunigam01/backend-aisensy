import { z } from "zod"

import {
  CLIENT_KYC_STATUSES,
  CLIENT_ONBOARDING_STATUSES,
  CLIENT_STATUSES,
} from "../constants/clients.js"
import { listControlFields } from "./list-query.js"

const emptyToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform(emptyToUndefined)

const optionalEmail = z
  .union([z.email("Enter a valid email"), z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined))

const websiteSchema = optionalText(300).refine(
  (value) => !value || /^https?:\/\//i.test(value),
  { message: "Enter a valid website URL starting with http:// or https://" }
)

const gstSchema = optionalText(15)
  .transform((value) => value?.toUpperCase())
  .refine((value) => !value || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value), {
    message: "Enter a valid 15-character GST number",
  })

const panSchema = optionalText(10)
  .transform((value) => value?.toUpperCase())
  .refine((value) => !value || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(value), {
    message: "Enter a valid 10-character PAN",
  })

export const contactPersonSchema = z.object({
  name: z.string().trim().min(1, "Enter a contact name").max(120),
  designation: optionalText(120),
  email: optionalEmail,
  phone: optionalText(30),
})

export const createClientSchema = z.object({
  companyName: z.string().trim().min(2, "Enter a company name").max(160),
  legalEntityName: optionalText(200),
  industry: optionalText(80),
  website: websiteSchema,
  GSTNumber: gstSchema,
  PANNumber: panSchema,
  registeredAddress: optionalText(400),
  address: optionalText(400),
  city: optionalText(80),
  state: optionalText(80),
  country: optionalText(80),
  contactPersons: z.array(contactPersonSchema).max(20).optional(),
  status: z.enum(CLIENT_STATUSES).optional(),
  onboardingStatus: z.enum(CLIENT_ONBOARDING_STATUSES).optional(),
  KYCStatus: z.enum(CLIENT_KYC_STATUSES).optional(),
  notes: optionalText(4000),
})

export const updateClientSchema = createClientSchema.partial()

export const clientListQuerySchema = z.object({
  status: z.enum(CLIENT_STATUSES).optional(),
  onboardingStatus: z.enum(CLIENT_ONBOARDING_STATUSES).optional(),
  KYCStatus: z.enum(CLIENT_KYC_STATUSES).optional(),
  ...listControlFields(["createdAt", "companyName", "status"] as const),
})

export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
export type ClientListQueryInput = z.infer<typeof clientListQuerySchema>
