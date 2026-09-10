import { z } from "zod"

import { passwordSchema } from "./auth.validators.js"
import {
  EMERGENCY_RELATIONSHIPS,
  EMPLOYABLE_ROLES,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  GENDERS,
  WORK_LOCATIONS,
} from "../constants/employees.js"
import { listControlFields } from "./list-query.js"
import { addressSchema, objectIdSchema } from "./organization.validators.js"

const emptyToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform(emptyToUndefined)

const optionalObjectId = objectIdSchema.nullable().optional()

const dateOnlySchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim()
    return trimmed ? trimmed : undefined
  })
  .refine((value) => value === undefined || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Use YYYY-MM-DD",
  })

const logoUrlSchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform(emptyToUndefined)
  .refine((value) => !value || /^https?:\/\//i.test(value) || value.startsWith("/"), {
    message: "Enter a valid image URL",
  })

const emergencyContactSchema = z.object({
  name: optionalText(120),
  relationship: z.enum(EMERGENCY_RELATIONSHIPS).nullable().optional(),
  phone: optionalText(30),
})

export const employeeListQuerySchema = z.object({
  departmentId: objectIdSchema.optional(),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional(),
  ...listControlFields(["firstName", "lastName", "createdAt", "joiningDate", "employmentStatus"] as const, 12),
})

export const createEmployeeSchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name").max(80),
  lastName: z.string().trim().min(1, "Enter a last name").max(80),
  email: z.email("Enter a valid work email"),
  password: passwordSchema,
  role: z.enum(EMPLOYABLE_ROLES).optional(),
  profileImage: logoUrlSchema,
  phone: optionalText(30),
  dateOfBirth: dateOnlySchema,
  gender: z.enum(GENDERS).nullable().optional(),
  address: addressSchema.optional(),
  departmentId: optionalObjectId,
  designationId: optionalObjectId,
  managerId: optionalObjectId,
  joiningDate: dateOnlySchema,
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  employmentStatus: z.enum(EMPLOYMENT_STATUSES).optional(),
  workLocation: z.enum(WORK_LOCATIONS).optional(),
  emergencyContact: emergencyContactSchema.optional(),
})

export const updateEmployeeSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter a first name").max(80),
    lastName: z.string().trim().min(1, "Enter a last name").max(80),
    email: z.email("Enter a valid work email"),
    role: z.enum(EMPLOYABLE_ROLES),
    profileImage: logoUrlSchema,
    phone: optionalText(30),
    dateOfBirth: dateOnlySchema.nullable(),
    gender: z.enum(GENDERS).nullable(),
    address: addressSchema,
    departmentId: optionalObjectId,
    designationId: optionalObjectId,
    managerId: optionalObjectId,
    joiningDate: dateOnlySchema.nullable(),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    employmentStatus: z.enum(EMPLOYMENT_STATUSES),
    workLocation: z.enum(WORK_LOCATIONS),
    emergencyContact: emergencyContactSchema,
  })
  .partial()

export type EmployeeListQueryInput = z.infer<typeof employeeListQuerySchema>
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>
