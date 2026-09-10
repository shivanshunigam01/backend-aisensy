import { ipKeyGenerator, rateLimit } from "express-rate-limit"

import { env } from "../config/env.js"
import { AppError } from "../utils/app-error.js"

export const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests())
  },
  keyGenerator: (req) => `global:${ipKeyGenerator(req.ip ?? "unknown")}`,
})

export const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests())
  },
  keyGenerator: (req) => `auth:${ipKeyGenerator(req.ip ?? "unknown")}`,
})

export const careersApplyLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests())
  },
  keyGenerator: (req) => `careers-apply:${ipKeyGenerator(req.ip ?? "unknown")}`,
})
