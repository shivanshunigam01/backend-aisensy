import { z } from "zod"

import { ATTENDANCE_STATUSES } from "../constants/attendance.js"
import { listControlFields, optionalSearchQuery, sortFieldQuery, sortOrderQuery } from "./list-query.js"
import { objectIdSchema } from "./organization.validators.js"

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")

const monthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}$/, "Use YYYY-MM")

export const checkInSchema = z.object({
  wfh: z.boolean().optional(),
  notes: z.string().trim().max(500).optional(),
})

export const updateAttendanceSchema = z
  .object({
    status: z.enum(ATTENDANCE_STATUSES),
    notes: z.string().trim().max(500),
    checkIn: z.string().datetime({ offset: true }).nullable(),
    checkOut: z.string().datetime({ offset: true }).nullable(),
    breakMinutes: z.number().int().min(0).max(24 * 60),
  })
  .partial()

export const attendanceListQuerySchema = z.object({
  employeeId: objectIdSchema.optional(),
  departmentId: objectIdSchema.optional(),
  status: z.enum(ATTENDANCE_STATUSES).optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  ...listControlFields(["date", "createdAt", "status", "checkIn"] as const),
})

export const attendanceDailyQuerySchema = z.object({
  date: dateOnlySchema.optional(),
  search: optionalSearchQuery,
  q: optionalSearchQuery,
  departmentId: objectIdSchema.optional(),
  status: z.enum([...ATTENDANCE_STATUSES, "rest"]).optional(),
  sort: sortFieldQuery(["firstName", "lastName", "createdAt"] as const),
  order: sortOrderQuery,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const attendanceCalendarQuerySchema = z.object({
  month: monthSchema.optional(),
  employeeId: objectIdSchema.optional(),
})

export const attendanceMonthlyQuerySchema = z.object({
  month: monthSchema.optional(),
  search: optionalSearchQuery,
  q: optionalSearchQuery,
  departmentId: objectIdSchema.optional(),
  sort: sortFieldQuery(["firstName", "lastName", "createdAt"] as const),
  order: sortOrderQuery,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type CheckInInput = z.infer<typeof checkInSchema>
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>
export type AttendanceListQueryInput = z.infer<typeof attendanceListQuerySchema>
export type AttendanceDailyQueryInput = z.infer<typeof attendanceDailyQuerySchema>
export type AttendanceCalendarQueryInput = z.infer<typeof attendanceCalendarQuerySchema>
export type AttendanceMonthlyQueryInput = z.infer<typeof attendanceMonthlyQuerySchema>
