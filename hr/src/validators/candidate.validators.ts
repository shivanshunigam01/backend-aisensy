import { z } from "zod"

import {
  CANDIDATE_CONSENT_METHODS,
  CANDIDATE_SOURCES,
  CANDIDATE_STATUSES,
} from "../constants/candidates.js"
import { listControlFields } from "./list-query.js"

const emptyToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform(emptyToUndefined)

const stringList = (maxItems: number, maxLength: number) =>
  z.array(z.string().trim().min(1).max(maxLength)).max(maxItems).optional()

const resumeUrlSchema = optionalText(500).refine(
  (value) => !value || /^https?:\/\//i.test(value) || value.startsWith("/"),
  { message: "Enter a valid resume URL" }
)

const consentSchema = z.object({
  given: z.boolean().optional(),
  date: z
    .string()
    .trim()
    .optional()
    .transform(emptyToUndefined)
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "Enter a valid consent date",
    }),
  method: z.enum(CANDIDATE_CONSENT_METHODS).optional(),
})

const candidateFields = z.object({
  firstName: z.string().trim().min(1, "Enter a first name").max(80),
  lastName: z.string().trim().min(1, "Enter a last name").max(80),
  email: z.email("Enter a valid email"),
  phone: optionalText(30),
  resumeUrl: resumeUrlSchema,
  currentCompany: optionalText(160),
  currentDesignation: optionalText(160),
  totalExperience: z.coerce.number().min(0).max(50).optional(),
  relevantExperience: z.coerce.number().min(0).max(50).optional(),
  currentCTC: z.coerce.number().min(0).optional(),
  expectedCTC: z.coerce.number().min(0).optional(),
  noticePeriod: optionalText(40),
  currentLocation: optionalText(160),
  preferredLocations: stringList(10, 80),
  skills: stringList(30, 40),
  qualifications: stringList(20, 160),
  source: z.enum(CANDIDATE_SOURCES).optional(),
  consent: consentSchema.optional(),
  status: z.enum(CANDIDATE_STATUSES).optional(),
})

export const createCandidateProfileSchema = candidateFields.refine(
  (value) =>
    value.relevantExperience === undefined ||
    value.totalExperience === undefined ||
    value.relevantExperience <= value.totalExperience,
  {
    message: "Relevant experience cannot exceed total experience",
    path: ["relevantExperience"],
  }
)

export const updateCandidateProfileSchema = candidateFields.partial()

const skillsQuery = z.preprocess((value) => {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return value
}, z.array(z.string().trim().min(1).max(40)).max(20).optional())

export const candidateProfileListQuerySchema = z.object({
  email: z.string().trim().max(160).optional().transform(emptyToUndefined),
  status: z.enum(CANDIDATE_STATUSES).optional(),
  source: z.enum(CANDIDATE_SOURCES).optional(),
  skills: skillsQuery,
  ...listControlFields(["createdAt", "firstName", "lastName", "status"] as const),
})

export type CreateCandidateProfileInput = z.infer<typeof createCandidateProfileSchema>
export type UpdateCandidateProfileInput = z.infer<typeof updateCandidateProfileSchema>
export type CandidateProfileListQueryInput = z.infer<typeof candidateProfileListQuerySchema>
