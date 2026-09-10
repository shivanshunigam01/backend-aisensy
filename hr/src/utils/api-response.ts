import type { Response } from "express"

import { HTTP_STATUS } from "../constants/http.js"
import { MESSAGES } from "../constants/messages.js"
import type { ApiError, ApiSuccess } from "../types/api.js"

type SuccessOptions<T> = {
  message?: string
  data?: T
  statusCode?: number
}

export function sendSuccess<T>(res: Response, options: SuccessOptions<T> = {}) {
  const { message = MESSAGES.SUCCESS, data, statusCode = HTTP_STATUS.OK } = options

  const body: ApiSuccess<T> = {
    success: true,
    message,
  }

  if (data !== undefined) {
    body.data = data
  }

  return res.status(statusCode).json(body)
}

export function sendError(
  res: Response,
  options: {
    message: string
    statusCode?: number
    errors?: unknown
  }
) {
  const {
    message,
    statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errors,
  } = options

  const body: ApiError = {
    success: false,
    message,
  }

  if (errors !== undefined) {
    body.errors = errors
  }

  return res.status(statusCode).json(body)
}
