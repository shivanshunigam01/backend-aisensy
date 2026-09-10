import type { Request, Response } from "express"

import { sendSuccess } from "../utils/api-response.js"
import { AppError } from "../utils/app-error.js"

export function listResource(req: Request, res: Response) {
  if (!req.auth) {
    throw AppError.unauthorized()
  }

  return sendSuccess(res, {
    message: "Access granted",
    data: {
      items: [],
      role: req.auth.role,
      permissions: req.auth.permissions,
    },
  })
}

export function mutateResource(req: Request, res: Response) {
  if (!req.auth) {
    throw AppError.unauthorized()
  }

  return sendSuccess(res, {
    message: "Access granted",
    data: {
      id: typeof req.params.id === "string" ? req.params.id : null,
      role: req.auth.role,
    },
  })
}

export function getAccess(req: Request, res: Response) {
  if (!req.auth) {
    throw AppError.unauthorized()
  }

  return sendSuccess(res, {
    data: {
      role: req.auth.role,
      permissions: req.auth.permissions,
    },
  })
}
