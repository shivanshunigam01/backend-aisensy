import { Router } from "express"
import { rateLimit, ipKeyGenerator } from "express-rate-limit"

import {
  completePublicAiInterview,
  createAiInterviewForApplication,
  getAiInterview,
  getAiInterviewConfig,
  getPublicAiInterview,
  listAiInterviews,
  overrideAiInterviewResult,
  regenerateAiInterviewLink,
  resendAiInterviewInvitation,
  startPublicAiInterview,
  submitPublicAiInterviewAnswer,
  updateAiInterviewConfig,
} from "../controllers/ai-interview.controller.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { env } from "../config/env.js"
import { authenticate } from "../middleware/authenticate.js"
import { asyncHandler } from "../middleware/async-handler.js"
import { authorizePermissions } from "../middleware/authorize.js"
import { validateBody, validateQuery } from "../middleware/validate.js"
import { AppError } from "../utils/app-error.js"
import {
  aiInterviewListQuerySchema,
  overrideAiInterviewResultSchema,
  submitAiInterviewAnswerSchema,
  updateAiInterviewConfigSchema,
} from "../validators/ai-interview.validators.js"

export const aiInterviewsRouter = Router()

const canRead = [PERMISSIONS.RECRUITMENT_READ, PERMISSIONS.RECRUITMENT_MANAGE] as const

const publicInterviewLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX * 2,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests())
  },
  keyGenerator: (req) => `ai-interview:${ipKeyGenerator(req.ip ?? "unknown")}`,
})

aiInterviewsRouter.get(
  "/token/:token",
  publicInterviewLimiter,
  asyncHandler(getPublicAiInterview)
)

aiInterviewsRouter.post(
  "/token/:token/start",
  publicInterviewLimiter,
  asyncHandler(startPublicAiInterview)
)

aiInterviewsRouter.post(
  "/token/:token/answer",
  publicInterviewLimiter,
  validateBody(submitAiInterviewAnswerSchema),
  asyncHandler(submitPublicAiInterviewAnswer)
)

aiInterviewsRouter.post(
  "/token/:token/complete",
  publicInterviewLimiter,
  asyncHandler(completePublicAiInterview)
)

aiInterviewsRouter.use(authenticate)

aiInterviewsRouter.get(
  "/",
  authorizePermissions(...canRead),
  validateQuery(aiInterviewListQuerySchema),
  asyncHandler(listAiInterviews)
)

aiInterviewsRouter.get(
  "/config",
  authorizePermissions(...canRead),
  asyncHandler(getAiInterviewConfig)
)

aiInterviewsRouter.patch(
  "/config",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(updateAiInterviewConfigSchema),
  asyncHandler(updateAiInterviewConfig)
)

aiInterviewsRouter.get("/:id", authorizePermissions(...canRead), asyncHandler(getAiInterview))

aiInterviewsRouter.post(
  "/:id/resend",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  asyncHandler(resendAiInterviewInvitation)
)

aiInterviewsRouter.post(
  "/:id/regenerate-link",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  asyncHandler(regenerateAiInterviewLink)
)

aiInterviewsRouter.patch(
  "/:id/override-result",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  validateBody(overrideAiInterviewResultSchema),
  asyncHandler(overrideAiInterviewResult)
)

export const jobApplicationAiRouter = Router()

jobApplicationAiRouter.use(authenticate)

jobApplicationAiRouter.post(
  "/:id/create-ai-interview",
  authorizePermissions(PERMISSIONS.RECRUITMENT_MANAGE),
  asyncHandler(createAiInterviewForApplication)
)
