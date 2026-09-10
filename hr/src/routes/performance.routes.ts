import { Router } from "express"

import {
  createGoal,
  createReview,
  deleteGoal,
  getGoal,
  getOverview,
  getReview,
  listGoals,
  listReviews,
  submitReview,
  updateGoal,
  updateGoalProgress,
  updateReview,
} from "../controllers/performance.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import {
  createGoalSchema,
  createReviewSchema,
  goalListQuerySchema,
  overviewQuerySchema,
  reviewListQuerySchema,
  updateGoalProgressSchema,
  updateGoalSchema,
  updateReviewSchema,
} from "../validators/performance.validators.js"

export const performanceRouter = Router()

performanceRouter.use(authenticate)

const canAccess = [
  PERMISSIONS.PERFORMANCE_READ,
  PERMISSIONS.PERFORMANCE_READ_TEAM,
  PERMISSIONS.PERFORMANCE_READ_SELF,
  PERMISSIONS.PERFORMANCE_MANAGE,
] as const

performanceRouter.get(
  "/overview",
  authorizePermissions(...canAccess),
  validateQuery(overviewQuerySchema),
  asyncHandler(getOverview)
)

performanceRouter.get(
  "/goals",
  authorizePermissions(...canAccess),
  validateQuery(goalListQuerySchema),
  asyncHandler(listGoals)
)

performanceRouter.post(
  "/goals",
  authorizePermissions(...canAccess),
  validateBody(createGoalSchema),
  asyncHandler(createGoal)
)

performanceRouter.get("/goals/:id", authorizePermissions(...canAccess), asyncHandler(getGoal))

performanceRouter.patch(
  "/goals/:id/progress",
  authorizePermissions(...canAccess),
  validateBody(updateGoalProgressSchema),
  asyncHandler(updateGoalProgress)
)

performanceRouter.patch(
  "/goals/:id",
  authorizePermissions(...canAccess),
  validateBody(updateGoalSchema),
  asyncHandler(updateGoal)
)

performanceRouter.delete("/goals/:id", authorizePermissions(...canAccess), asyncHandler(deleteGoal))

performanceRouter.get(
  "/reviews",
  authorizePermissions(...canAccess),
  validateQuery(reviewListQuerySchema),
  asyncHandler(listReviews)
)

performanceRouter.post(
  "/reviews",
  authorizePermissions(...canAccess),
  validateBody(createReviewSchema),
  asyncHandler(createReview)
)

performanceRouter.post(
  "/reviews/:id/submit",
  authorizePermissions(...canAccess),
  asyncHandler(submitReview)
)

performanceRouter.get("/reviews/:id", authorizePermissions(...canAccess), asyncHandler(getReview))

performanceRouter.patch(
  "/reviews/:id",
  authorizePermissions(...canAccess),
  validateBody(updateReviewSchema),
  asyncHandler(updateReview)
)

