import { z } from "zod"

import { EMPLOYMENT_TYPES } from "../constants/employees.js"
import {
  APPLICATION_STAGES,
  JOB_STATUSES,
} from "../constants/recruitment.js"
import { listControlFields, optionalSearchQuery, sortFieldQuery, sortOrderQuery } from "./list-query.js"
import { objectIdSchema } from "./organization.validators.js"

const emptyToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const skillsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .optional()
  .default([])

const optionalObjectId = z
  .string()
  .trim()
  .optional()
  .transform(emptyToUndefined)
  .refine((value) => !value || /^[a-fA-F0-9]{24}$/.test(value), {
    message: "Invalid identifier",
  })

export const createJobSchema = z.object({
  title: z.string().trim().min(2, "Enter a job title").max(120),
  departmentId: optionalObjectId,
  location: z.string().trim().max(120).optional().transform(emptyToUndefined),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  description: z.string().trim().max(8000).optional().transform(emptyToUndefined),
  status: z.enum(JOB_STATUSES).optional(),
})

export const updateJobSchema = createJobSchema.partial()

export const jobListQuerySchema = z.object({
  status: z.enum(JOB_STATUSES).optional(),
  departmentId: objectIdSchema.optional(),
  ...listControlFields(["createdAt", "title", "status"] as const),
})

export const createCandidateSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(120),
  email: z.email("Enter a valid email"),
  phone: z.string().trim().max(30).optional().transform(emptyToUndefined),
  resume: z.string().trim().max(500).optional().transform(emptyToUndefined),
  experience: z.coerce.number().min(0).max(50).optional().default(0),
  skills: skillsSchema,
})

export const updateCandidateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.email().optional(),
  phone: z.string().trim().max(30).optional().transform(emptyToUndefined),
  resume: z.string().trim().max(500).optional().transform(emptyToUndefined),
  experience: z.coerce.number().min(0).max(50).optional(),
  skills: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
})

export const candidateListQuerySchema = z.object({
  ...listControlFields(["createdAt", "name", "email"] as const),
})

export const createApplicationSchema = z
  .object({
    jobId: objectIdSchema,
    candidateId: objectIdSchema.optional(),
    name: z.string().trim().min(2).max(120).optional(),
    email: z.email().optional(),
    phone: z.string().trim().max(30).optional().transform(emptyToUndefined),
    resume: z.string().trim().max(500).optional().transform(emptyToUndefined),
    experience: z.coerce.number().min(0).max(50).optional(),
    skills: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    notes: z.string().trim().max(4000).optional().transform(emptyToUndefined),
    appliedDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
      .optional(),
  })
  .refine((value) => Boolean(value.candidateId || (value.name && value.email)), {
    message: "Select a candidate or enter a name and email",
  })

export const updateApplicationSchema = z
  .object({
    stage: z.enum(APPLICATION_STAGES).optional(),
    notes: z.string().trim().max(4000).optional(),
    sortOrder: z.coerce.number().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  })

export const applicationListQuerySchema = z.object({
  search: optionalSearchQuery,
  q: optionalSearchQuery,
  jobId: objectIdSchema.optional(),
  candidateId: objectIdSchema.optional(),
  stage: z.enum(APPLICATION_STAGES).optional(),
  sort: sortFieldQuery(["sortOrder", "appliedDate", "createdAt", "stage"] as const),
  order: sortOrderQuery,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const boardQuerySchema = z.object({
  jobId: objectIdSchema.optional(),
  search: optionalSearchQuery,
  q: optionalSearchQuery,
})

export type CreateJobInput = z.infer<typeof createJobSchema>
export type UpdateJobInput = z.infer<typeof updateJobSchema>
export type JobListQueryInput = z.infer<typeof jobListQuerySchema>
export type CreateCandidateInput = z.infer<typeof createCandidateSchema>
export type UpdateCandidateInput = z.infer<typeof updateCandidateSchema>
export type CandidateListQueryInput = z.infer<typeof candidateListQuerySchema>
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>
export type ApplicationListQueryInput = z.infer<typeof applicationListQuerySchema>
export type BoardQueryInput = z.infer<typeof boardQuerySchema>
