import { z } from "zod"

import { EMPLOYMENT_TYPES } from "../constants/employees.js"
import {
  MANDATE_FEE_TYPES,
  MANDATE_PRIORITIES,
  MANDATE_STATUSES,
  MANDATE_WORK_MODES,
} from "../constants/mandates.js"
import { listControlFields } from "./list-query.js"
import { objectIdSchema } from "./organization.validators.js"

const emptyToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .optional()
    .transform(emptyToUndefined)

const stringList = (maxItems: number, maxLength: number, label: string) =>
  z
    .array(
      z
        .string()
        .trim()
        .min(1, `${label}: each entry is required`)
        .max(maxLength, `${label}: each entry must be ${maxLength} characters or fewer`)
    )
    .max(maxItems, `${label}: add at most ${maxItems} entries`)
    .optional()

const experienceSchema = z
  .object({
    minimum: z.coerce.number().min(0).max(50).optional(),
    maximum: z.coerce.number().min(0).max(50).optional(),
  })
  .refine(
    (value) =>
      value.minimum === undefined ||
      value.maximum === undefined ||
      value.maximum >= value.minimum,
    { message: "Maximum experience must be greater than or equal to minimum", path: ["maximum"] }
  )

const salarySchema = z
  .object({
    minimum: z.coerce.number().min(0).optional(),
    maximum: z.coerce.number().min(0).optional(),
    currency: z.string().trim().max(8).optional().transform(emptyToUndefined),
    fixedPercent: z.coerce.number().min(0).max(100).optional().nullable(),
    variablePercent: z.coerce.number().min(0).max(100).optional().nullable(),
  })
  .refine(
    (value) =>
      value.minimum === undefined ||
      value.maximum === undefined ||
      value.maximum >= value.minimum,
    { message: "Maximum salary must be greater than or equal to minimum", path: ["maximum"] }
  )

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")

const optionalDateOnly = z
  .union([dateOnlySchema, z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined))

const mandateFields = z.object({
  clientId: objectIdSchema,
  agreementId: objectIdSchema,
  position: z
    .string()
    .trim()
    .min(2, "Enter a position")
    .max(160, "Position must be 160 characters or fewer"),
  department: optionalText(120, "Department"),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  vacancies: z.coerce.number().int().min(1, "Vacancies must be at least 1").max(999, "Vacancies cannot exceed 999").optional(),
  location: optionalText(160, "Location"),
  workMode: z.enum(MANDATE_WORK_MODES).optional(),
  reportingTo: optionalText(160, "Reporting to"),
  experience: experienceSchema.optional(),
  salary: salarySchema.optional(),
  qualifications: stringList(20, 160, "Qualifications"),
  skills: stringList(30, 40, "Skills"),
  mustHaveSkills: stringList(30, 40, "Must-have skills"),
  preferredSkills: stringList(30, 40, "Preferred skills"),
  responsibilities: stringList(40, 400, "Responsibilities"),
  criticalRequirements: stringList(20, 240, "Critical requirements"),
  interviewProcess: stringList(15, 160, "Interview process"),
  industryPreference: optionalText(160, "Industry preference"),
  teamSize: optionalText(120, "Team size"),
  acceptedNoticePeriod: optionalText(80, "Accepted notice period"),
  travelRequirement: optionalText(240, "Travel requirement"),
  workingDaysHours: optionalText(240, "Working days and hours"),
  targetJoiningDate: optionalDateOnly,
  paymentTermsDays: z.coerce.number().int().min(0).max(365).optional(),
  exclusivity: z.boolean().optional(),
  specialInstructions: z
    .string()
    .trim()
    .max(4000, "Special instructions must be 4000 characters or fewer")
    .optional()
    .transform(emptyToUndefined),
  assignedRecruiters: z
    .array(objectIdSchema)
    .max(20, "Assigned recruiters: select at most 20 people")
    .optional(),
  recruitmentFee: z.coerce.number().min(0).optional(),
  feeType: z.enum(MANDATE_FEE_TYPES).optional(),
  replacementPeriodDays: z.coerce.number().int().min(0).max(730).optional(),
  priority: z.enum(MANDATE_PRIORITIES).optional(),
  status: z.enum(MANDATE_STATUSES).optional(),
  isPublic: z.boolean().optional(),
})

function withFeeCap<T extends z.ZodType>(schema: T) {
  return schema.superRefine((value, ctx) => {
    const body = value as { feeType?: string; recruitmentFee?: number }
    if (body.feeType === "PERCENTAGE" && body.recruitmentFee !== undefined && body.recruitmentFee > 100) {
      ctx.addIssue({
        code: "custom",
        message: "Percentage fee cannot exceed 100",
        path: ["recruitmentFee"],
      })
    }
  })
}

export const createMandateSchema = withFeeCap(mandateFields)
export const updateMandateSchema = withFeeCap(mandateFields.partial())

export const mandateListQuerySchema = z.object({
  status: z.enum(MANDATE_STATUSES).optional(),
  priority: z.enum(MANDATE_PRIORITIES).optional(),
  clientId: objectIdSchema.optional(),
  agreementId: objectIdSchema.optional(),
  recruiterId: objectIdSchema.optional(),
  ...listControlFields(["createdAt", "mandateNumber", "position", "status", "priority"] as const),
})

export type CreateMandateInput = z.infer<typeof createMandateSchema>
export type UpdateMandateInput = z.infer<typeof updateMandateSchema>
export type MandateListQueryInput = z.infer<typeof mandateListQuerySchema>
