import { z } from "zod"

import {
  GOAL_STATUSES,
  PERFORMANCE_RATINGS,
  REVIEW_KINDS,
  REVIEW_STATUSES,
} from "../constants/performance.js"
import { listControlFields } from "./list-query.js"
import { objectIdSchema } from "./organization.validators.js"

const emptyToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const dateKeySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")

const periodSchema = z
  .string()
  .trim()
  .regex(/^\d{4}(-Q[1-4])?$/, "Use YYYY or YYYY-Q1 through YYYY-Q4")

export const createGoalSchema = z.object({
  employeeId: objectIdSchema.optional(),
  title: z.string().trim().min(2, "Enter a goal title").max(160),
  description: z.string().trim().max(2000).optional().transform(emptyToUndefined),
  progress: z.coerce.number().min(0).max(100).optional().default(0),
  deadline: dateKeySchema.optional(),
  status: z.enum(GOAL_STATUSES).optional(),
})

export const updateGoalSchema = z
  .object({
    title: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(2000).optional(),
    progress: z.coerce.number().min(0).max(100).optional(),
    deadline: dateKeySchema.nullable().optional(),
    status: z.enum(GOAL_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  })

export const updateGoalProgressSchema = z.object({
  progress: z.coerce.number().min(0).max(100),
})

export const goalListQuerySchema = z.object({
  employeeId: objectIdSchema.optional(),
  status: z.enum(GOAL_STATUSES).optional(),
  ...listControlFields(["deadline", "createdAt", "status", "title"] as const),
})

export const createReviewSchema = z.object({
  employeeId: objectIdSchema.optional(),
  kind: z.enum(REVIEW_KINDS).optional(),
  reviewPeriod: periodSchema,
  rating: z.coerce.number().int().min(1).max(5).optional(),
  strengths: z.string().trim().max(2000).optional().transform(emptyToUndefined),
  improvements: z.string().trim().max(2000).optional().transform(emptyToUndefined),
  feedback: z.string().trim().max(4000).optional().transform(emptyToUndefined),
})

export const updateReviewSchema = z
  .object({
    reviewPeriod: periodSchema.optional(),
    rating: z.coerce
      .number()
      .int()
      .refine((value) => (PERFORMANCE_RATINGS as readonly number[]).includes(value))
      .optional(),
    strengths: z.string().trim().max(2000).optional(),
    improvements: z.string().trim().max(2000).optional(),
    feedback: z.string().trim().max(4000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  })

export const reviewListQuerySchema = z.object({
  employeeId: objectIdSchema.optional(),
  kind: z.enum(REVIEW_KINDS).optional(),
  status: z.enum(REVIEW_STATUSES).optional(),
  reviewPeriod: periodSchema.optional(),
  ...listControlFields(["reviewPeriod", "createdAt", "status"] as const),
})

export const overviewQuerySchema = z.object({
  employeeId: objectIdSchema.optional(),
})

export type CreateGoalInput = z.infer<typeof createGoalSchema>
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>
export type UpdateGoalProgressInput = z.infer<typeof updateGoalProgressSchema>
export type GoalListQueryInput = z.infer<typeof goalListQuerySchema>
export type CreateReviewInput = z.infer<typeof createReviewSchema>
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>
export type ReviewListQueryInput = z.infer<typeof reviewListQuerySchema>
export type OverviewQueryInput = z.infer<typeof overviewQuerySchema>
