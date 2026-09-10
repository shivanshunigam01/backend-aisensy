import { z } from "zod"

import { LEAVE_REQUEST_STATUSES } from "../constants/leave.js"
import { listControlFields } from "./list-query.js"
import { objectIdSchema } from "./organization.validators.js"

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")

const monthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}$/, "Use YYYY-MM")

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => {
    const trimmed = value?.trim()
    return trimmed ? trimmed : undefined
  })
  .refine((value) => !value || /^https?:\/\//i.test(value) || value.startsWith("/"), {
    message: "Enter a valid file URL",
  })

export const createLeaveTypeSchema = z.object({
  name: z.string().trim().min(2, "Enter a leave type name").max(80),
  code: z
    .string()
    .trim()
    .min(2, "Enter a code")
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, dashes, or underscores"),
  maxDays: z.coerce.number().int().min(0).max(365),
  isPaid: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const updateLeaveTypeSchema = createLeaveTypeSchema.partial()

export const applyLeaveSchema = z
  .object({
    leaveTypeId: objectIdSchema,
    startDate: dateOnlySchema,
    endDate: dateOnlySchema,
    reason: z.string().trim().min(4, "Enter a short reason").max(500),
    attachment: optionalUrl,
  })
  .refine((value) => value.startDate <= value.endDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  })

export const decideLeaveSchema = z.object({
  comment: z.string().trim().max(400).optional(),
})

export const leaveListQuerySchema = z.object({
  employeeId: objectIdSchema.optional(),
  leaveTypeId: objectIdSchema.optional(),
  status: z.enum(LEAVE_REQUEST_STATUSES).optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  ...listControlFields(["createdAt", "startDate", "status"] as const, 12),
})

export const leaveBalanceQuerySchema = z.object({
  employeeId: objectIdSchema.optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
})

export const leaveCalendarQuerySchema = z.object({
  month: monthSchema.optional(),
  employeeId: objectIdSchema.optional(),
})

export const leavePreviewQuerySchema = z.object({
  startDate: dateOnlySchema,
  endDate: dateOnlySchema,
})

export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>
export type UpdateLeaveTypeInput = z.infer<typeof updateLeaveTypeSchema>
export type ApplyLeaveInput = z.infer<typeof applyLeaveSchema>
export type DecideLeaveInput = z.infer<typeof decideLeaveSchema>
export type LeaveListQueryInput = z.infer<typeof leaveListQuerySchema>
export type LeaveBalanceQueryInput = z.infer<typeof leaveBalanceQuerySchema>
export type LeaveCalendarQueryInput = z.infer<typeof leaveCalendarQuerySchema>
export type LeavePreviewQueryInput = z.infer<typeof leavePreviewQuerySchema>
