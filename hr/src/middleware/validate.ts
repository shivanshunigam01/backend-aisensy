import type { NextFunction, Request, RequestHandler, Response } from "express"
import type { ZodType } from "zod"

import { validationFromZod } from "../utils/zod-errors.js"

export function validateBody(schema: ZodType): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      next(validationFromZod(result.error))
      return
    }

    req.body = result.data
    next()
  }
}

export function validateQuery(schema: ZodType): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query)

    if (!result.success) {
      next(validationFromZod(result.error))
      return
    }

    req.validatedQuery = result.data
    next()
  }
}
