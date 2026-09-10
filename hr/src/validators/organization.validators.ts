import { z } from "zod"

import {
  COMPANY_SIZES,
  DATE_FORMATS,
  TIME_PATTERN,
  WEEKDAYS,
} from "../constants/organization.js"
import { listControlFields } from "./list-query.js"

export const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid identifier")

const emptyToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform(emptyToUndefined)

const timeSchema = z.string().regex(TIME_PATTERN, "Use HH:mm, for example 09:00")

export const listQuerySchema = z.object({
  isActive: z.enum(["true", "false"]).optional(),
  departmentId: objectIdSchema.optional(),
  ...listControlFields(["name", "title", "createdAt"] as const, 10),
})

export const addressSchema = z.object({
  line1: optionalText(160),
  line2: optionalText(160),
  city: optionalText(80),
  state: optionalText(80),
  postalCode: optionalText(20),
  country: optionalText(80),
})

export const workingHoursSchema = z
  .object({
    start: timeSchema,
    end: timeSchema,
  })
  .refine((value) => value.start < value.end, {
    message: "Working hours must end after they start",
    path: ["end"],
  })

export const organizationSettingsSchema = z.object({
  dateFormat: z.enum(DATE_FORMATS).optional(),
  weekStartsOn: z.enum(["monday", "sunday"]).optional(),
})

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Enter an organization name").max(120).optional(),
  logo: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform(emptyToUndefined)
    .refine((value) => !value || /^https?:\/\//i.test(value) || value.startsWith("/"), {
      message: "Enter a valid logo URL",
    }),
  industry: optionalText(80),
  companySize: z.enum(COMPANY_SIZES).nullable().optional(),
  email: z
    .union([z.email("Enter a valid email"), z.literal("")])
    .optional()
    .transform((value) => (value ? value : undefined)),
  phone: optionalText(30),
  address: addressSchema.optional(),
  timezone: optionalText(80),
  workingDays: z.array(z.enum(WEEKDAYS)).min(1, "Select at least one working day").optional(),
  workingHours: workingHoursSchema.optional(),
  settings: organizationSettingsSchema.optional(),
})

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2, "Enter a department name").max(80),
  code: z
    .string()
    .trim()
    .min(2, "Enter a code")
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, dashes, or underscores"),
  description: optionalText(400),
  headId: objectIdSchema.nullable().optional(),
  isActive: z.boolean().optional(),
})

export const updateDepartmentSchema = createDepartmentSchema.partial()

export const createDesignationSchema = z.object({
  title: z.string().trim().min(2, "Enter a designation title").max(80),
  departmentId: objectIdSchema,
  description: optionalText(400),
  isActive: z.boolean().optional(),
})

export const updateDesignationSchema = createDesignationSchema.partial()

export type ListQueryInput = z.infer<typeof listQuerySchema>
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>
export type CreateDesignationInput = z.infer<typeof createDesignationSchema>
export type UpdateDesignationInput = z.infer<typeof updateDesignationSchema>
