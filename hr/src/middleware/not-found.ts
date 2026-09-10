import type { RequestHandler } from "express"

import { AppError } from "../utils/app-error.js"

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.path} not found`))
}
