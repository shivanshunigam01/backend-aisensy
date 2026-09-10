import type { NextFunction, Request, Response } from "express"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { ZodError } from "zod"

import { env } from "../config/env.js"
import { HTTP_STATUS } from "../constants/http.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"
import { sendError } from "../utils/api-response.js"
import { validationFromZod } from "../utils/zod-errors.js"

const isProduction = env.NODE_ENV === "production"

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error instanceof ZodError) {
    return validationFromZod(error)
  }

  if (error instanceof jwt.TokenExpiredError) {
    return AppError.unauthorized("Token expired")
  }

  if (error instanceof jwt.JsonWebTokenError) {
    return AppError.unauthorized("Invalid token")
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return AppError.validation(MESSAGES.VALIDATION_ERROR, error.errors)
  }

  if (error instanceof mongoose.Error.CastError) {
    return AppError.badRequest("Invalid identifier")
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  ) {
    const duplicate = error as { keyValue?: unknown; keyPattern?: unknown }
    return new AppError(
      "A record with that value already exists",
      HTTP_STATUS.CONFLICT,
      isProduction
        ? undefined
        : {
            keyPattern: duplicate.keyPattern,
            keyValue: duplicate.keyValue,
          }
    )
  }

  if (error instanceof SyntaxError) {
    return AppError.badRequest("Invalid JSON payload")
  }

  return AppError.internal()
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const appError = toAppError(error)
  const statusCode = appError.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR

  if (!appError.isOperational || statusCode >= 500) {
    console.error(`[${req.method}] ${req.originalUrl}`, error)
  }

  return sendError(res, {
    statusCode,
    message:
      statusCode >= 500 && isProduction
        ? MESSAGES.INTERNAL_ERROR
        : appError.message,
    errors: statusCode >= 500 && isProduction ? undefined : appError.errors,
  })
}
