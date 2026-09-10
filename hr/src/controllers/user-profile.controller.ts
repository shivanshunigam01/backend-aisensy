import type { Request, Response } from "express"

import { MESSAGES } from "../constants/messages.js"
import * as userProfileService from "../services/user-profile.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import type { UpdateOwnProfileInput } from "../validators/profile.validators.js"

function requireAuth(req: Request) {
  if (!req.auth) {
    throw AppError.unauthorized()
  }
  return req.auth
}

export async function updateOwnProfile(req: Request, res: Response) {
  const user = await userProfileService.updateOwnProfile(
    requireAuth(req),
    req.body as UpdateOwnProfileInput
  )
  return sendSuccess(res, {
    message: MESSAGES.PROFILE_UPDATED,
    data: { user },
  })
}

export async function updateOwnAvatar(req: Request, res: Response) {
  const user = await userProfileService.updateOwnAvatar(requireAuth(req), req.file)
  return sendSuccess(res, {
    message: MESSAGES.AVATAR_UPDATED,
    data: { user },
  })
}
