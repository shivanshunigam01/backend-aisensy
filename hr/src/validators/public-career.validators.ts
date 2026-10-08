import { z } from "zod"

import { EMPLOYMENT_TYPES } from "../constants/employees.js"
import { JOB_APPLICATION_STATUSES } from "../constants/job-applications.js"
import { listControlFields } from "./list-query.js"
import { objectIdSchema } from "./organization.validators.js"

const emptyToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const csvList = (maxItems: number, maxLength: number) =>
  z.preprocess((value) => {
    if (typeof value === "string") {
      return value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean)
    }
    return value
  }, z.array(z.string().trim().min(1).max(maxLength)).max(maxItems).optional())

const booleanFromForm = z.preprocess((value) => {
  if (value === true || value === "true" || value === "on" || value === "1") return true
  if (value === false || value === "false" || value === "off" || value === "0" || value === "") {
    return false
  }
  return value
}, z.boolean())

export const publicCareerListQuerySchema = z.object({
  search: z.string().trim().max(80).optional().transform(emptyToUndefined),
  location: z.string().trim().max(160).optional().transform(emptyToUndefined),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  workMode: z.string().trim().max(24).optional().transform(emptyToUndefined),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const publicCareerApplySchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name").max(80),
  lastName: z.string().trim().min(1, "Enter a last name").max(80),
  email: z.email("Enter a valid email"),
  phone: z.string().trim().min(7, "Enter a phone number").max(30),
  currentCompany: z.string().trim().max(160).optional().transform(emptyToUndefined),
  currentDesignation: z.string().trim().max(160).optional().transform(emptyToUndefined),
  totalExperience: z.coerce.number().min(0).max(50).optional().default(0),
  relevantExperience: z.coerce.number().min(0).max(50).optional().default(0),
  currentCTC: z.coerce.number().min(0).optional().default(0),
  expectedCTC: z.coerce.number().min(0).optional().default(0),
  noticePeriod: z.string().trim().max(40).optional().transform(emptyToUndefined),
  currentLocation: z.string().trim().max(160).optional().transform(emptyToUndefined),
  preferredLocations: csvList(10, 80),
  skills: csvList(30, 40),
  qualifications: csvList(20, 160),
  linkedInUrl: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform(emptyToUndefined)
    .refine((value) => !value || /^https?:\/\//i.test(value), {
      message: "Enter a valid LinkedIn URL",
    }),
  notes: z.string().trim().max(4000).optional().transform(emptyToUndefined),
  consent: booleanFromForm.refine((value) => value === true, {
    message: "Consent is required to apply",
  }),
})

export const jobApplicationListQuerySchema = z.object({
  mandateId: objectIdSchema.optional(),
  candidateId: objectIdSchema.optional(),
  status: z.enum(JOB_APPLICATION_STATUSES).optional(),
  source: z.string().trim().max(40).optional().transform(emptyToUndefined),
  ...listControlFields(["createdAt", "appliedAt", "applicationNumber", "status"] as const),
})

export const updateJobApplicationSchema = z
  .object({
    status: z.enum(JOB_APPLICATION_STATUSES).optional(),
    convertToWorkflow: z.boolean().optional(),
    notes: z.string().trim().max(4000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  })

export type PublicCareerListQueryInput = z.infer<typeof publicCareerListQuerySchema>
export type PublicCareerApplyInput = z.infer<typeof publicCareerApplySchema>
export type JobApplicationListQueryInput = z.infer<typeof jobApplicationListQuerySchema>
export type UpdateJobApplicationInput = z.infer<typeof updateJobApplicationSchema>
