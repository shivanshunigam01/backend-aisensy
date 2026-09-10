import type { Request, Response } from "express"

import * as performanceService from "../services/performance.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type {
  CreateGoalInput,
  CreateReviewInput,
  GoalListQueryInput,
  OverviewQueryInput,
  ReviewListQueryInput,
  UpdateGoalInput,
  UpdateGoalProgressInput,
  UpdateReviewInput,
} from "../validators/performance.validators.js"

function requireAuth(req: Request) {
  if (!req.auth) {
    throw AppError.unauthorized()
  }

  return req.auth
}

function routeId(req: Request, key = "id") {
  const id = req.params[key]
  if (typeof id !== "string") {
    throw AppError.badRequest("Invalid identifier")
  }
  return id
}

export async function getOverview(req: Request, res: Response) {
  const data = await performanceService.getOverview(
    requireAuth(req),
    req.validatedQuery as OverviewQueryInput
  )
  return sendSuccess(res, { data })
}

export async function listGoals(req: Request, res: Response) {
  const data = await performanceService.listGoals(
    requireAuth(req),
    req.validatedQuery as GoalListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getGoal(req: Request, res: Response) {
  const data = await performanceService.getGoal(requireAuth(req), routeId(req))
  return sendSuccess(res, { data })
}

export async function createGoal(req: Request, res: Response) {
  const data = await performanceService.createGoal(requireAuth(req), req.body as CreateGoalInput)
  return sendSuccess(res, { message: "Goal created", data })
}

export async function updateGoal(req: Request, res: Response) {
  const data = await performanceService.updateGoal(
    requireAuth(req),
    routeId(req),
    req.body as UpdateGoalInput
  )
  return sendSuccess(res, { message: "Goal updated", data })
}

export async function updateGoalProgress(req: Request, res: Response) {
  const data = await performanceService.updateGoalProgress(
    requireAuth(req),
    routeId(req),
    req.body as UpdateGoalProgressInput
  )
  return sendSuccess(res, { message: "Progress updated", data })
}

export async function deleteGoal(req: Request, res: Response) {
  await performanceService.deleteGoal(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Goal deleted" })
}

export async function listReviews(req: Request, res: Response) {
  const data = await performanceService.listReviews(
    requireAuth(req),
    req.validatedQuery as ReviewListQueryInput
  )
  return sendSuccess(res, { data })
}

export async function getReview(req: Request, res: Response) {
  const data = await performanceService.getReview(requireAuth(req), routeId(req))
  return sendSuccess(res, { data })
}

export async function createReview(req: Request, res: Response) {
  const data = await performanceService.createReview(requireAuth(req), req.body as CreateReviewInput)
  return sendSuccess(res, { message: "Review saved", data })
}

export async function updateReview(req: Request, res: Response) {
  const data = await performanceService.updateReview(
    requireAuth(req),
    routeId(req),
    req.body as UpdateReviewInput
  )
  return sendSuccess(res, { message: "Review updated", data })
}

export async function submitReview(req: Request, res: Response) {
  const data = await performanceService.submitReview(requireAuth(req), routeId(req))
  return sendSuccess(res, { message: "Review submitted", data })
}
