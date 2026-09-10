import { z } from "zod"

import { PAYROLL_STATUSES } from "../constants/payroll.js"
import { roundMoney } from "../utils/payroll.js"
import { listControlFields } from "./list-query.js"
import { objectIdSchema } from "./organization.validators.js"

const emptyToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const moneySchema = z.coerce
  .number()
  .min(0, "Must be 0 or more")
  .max(10_000_000, "Amount is too large")
  .transform(roundMoney)

const dateKeySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")

const monthSchema = z.coerce.number().int().min(1).max(12)
const yearSchema = z.coerce.number().int().min(2000).max(2100)

export const salaryAmountsSchema = z.object({
  basicSalary: moneySchema,
  hra: moneySchema.optional().default(0),
  allowances: moneySchema.optional().default(0),
  bonus: moneySchema.optional().default(0),
  deductions: moneySchema.optional().default(0),
})

export const createSalaryStructureSchema = salaryAmountsSchema.extend({
  employeeId: objectIdSchema,
  effectiveFrom: dateKeySchema,
})

export const updateSalaryStructureSchema = z
  .object({
    basicSalary: moneySchema.optional(),
    hra: moneySchema.optional(),
    allowances: moneySchema.optional(),
    bonus: moneySchema.optional(),
    deductions: moneySchema.optional(),
    effectiveFrom: dateKeySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  })

export const payrollListQuerySchema = z.object({
  employeeId: objectIdSchema.optional(),
  month: monthSchema.optional(),
  year: yearSchema.optional(),
  status: z.enum(PAYROLL_STATUSES).optional(),
  ...listControlFields(["year", "month", "createdAt", "status"] as const, 12),
})

export const structureListQuerySchema = z.object({
  employeeId: objectIdSchema.optional(),
  ...listControlFields(["effectiveFrom", "createdAt"] as const, 12),
})

export const payrollPreviewQuerySchema = z.object({
  employeeId: objectIdSchema,
  month: monthSchema,
  year: yearSchema,
})

export const generatePayrollSchema = z.object({
  month: monthSchema,
  year: yearSchema,
  employeeIds: z.array(objectIdSchema).max(200).optional(),
})

export type CreateSalaryStructureInput = z.infer<typeof createSalaryStructureSchema>
export type UpdateSalaryStructureInput = z.infer<typeof updateSalaryStructureSchema>
export type PayrollListQueryInput = z.infer<typeof payrollListQuerySchema>
export type StructureListQueryInput = z.infer<typeof structureListQuerySchema>
export type PayrollPreviewQueryInput = z.infer<typeof payrollPreviewQuerySchema>
export type GeneratePayrollInput = z.infer<typeof generatePayrollSchema>
