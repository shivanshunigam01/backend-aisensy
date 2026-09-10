import { HTTP_STATUS, type HttpStatus } from "../constants/http.js"
import { MESSAGES } from "../constants/messages.js"

export class AppError extends Error {
  readonly statusCode: HttpStatus
  readonly errors?: unknown
  readonly isOperational: boolean

  constructor(
    message: string,
    statusCode: HttpStatus = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errors?: unknown,
    isOperational = true
  ) {
    super(message)
    this.name = "AppError"
    this.statusCode = statusCode
    this.errors = errors
    this.isOperational = isOperational
    Error.captureStackTrace(this, this.constructor)
  }

  static unauthorized(message: string = MESSAGES.UNAUTHORIZED) {
    return new AppError(message, HTTP_STATUS.UNAUTHORIZED)
  }

  static forbidden(message: string = MESSAGES.FORBIDDEN) {
    return new AppError(message, HTTP_STATUS.FORBIDDEN)
  }

  static conflict(message: string = MESSAGES.EMAIL_IN_USE, errors?: unknown) {
    return new AppError(message, HTTP_STATUS.CONFLICT, errors)
  }

  static badRequest(message: string = MESSAGES.BAD_REQUEST, errors?: unknown) {
    return new AppError(message, HTTP_STATUS.BAD_REQUEST, errors)
  }

  static validation(message: string = MESSAGES.VALIDATION_ERROR, errors?: unknown) {
    return new AppError(message, HTTP_STATUS.UNPROCESSABLE_ENTITY, errors)
  }

  static notFound(message: string = MESSAGES.NOT_FOUND) {
    return new AppError(message, HTTP_STATUS.NOT_FOUND)
  }

  static tooManyRequests(message: string = MESSAGES.TOO_MANY_REQUESTS) {
    return new AppError(message, HTTP_STATUS.TOO_MANY_REQUESTS)
  }

  static internal(message: string = MESSAGES.INTERNAL_ERROR) {
    return new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
}
