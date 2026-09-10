import type { Request, Response } from "express"

import { HTTP_STATUS } from "../constants/http.js"
import { MESSAGES } from "../constants/messages.js"
import * as authService from "../services/auth.service.js"
import { AppError } from "../utils/app-error.js"
import { sendSuccess } from "../utils/api-response.js"
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from "../utils/cookies.js"
import { getAccessTokenExpiresAt, verifyAccessToken, verifyRefreshToken } from "../utils/jwt.js"
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "../validators/auth.validators.js"

function sendSession(
  res: Response,
  session: Awaited<ReturnType<typeof authService.login>>,
  options: { message: string; statusCode?: number }
) {
  setRefreshCookie(res, session.refreshToken)

  return sendSuccess(res, {
    statusCode: options.statusCode,
    message: options.message,
    data: {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: getAccessTokenExpiresAt(session.accessToken),
      user: session.user,
    },
  })
}

function readIncomingRefreshToken(req: Request) {
  const fromCookie = readRefreshCookie(req)
  if (fromCookie) {
    return fromCookie
  }

  const fromBody = req.body?.refreshToken
  return typeof fromBody === "string" && fromBody.trim() ? fromBody.trim() : undefined
}

async function resolveLogoutUserId(req: Request) {
  const header = req.headers.authorization

  if (header?.startsWith("Bearer ")) {
    try {
      return verifyAccessToken(header.slice("Bearer ".length).trim()).sub
    } catch {
      // Fall through to the refresh cookie.
    }
  }

  const refreshToken = readIncomingRefreshToken(req)

  if (!refreshToken) {
    return null
  }

  try {
    return verifyRefreshToken(refreshToken).sub
  } catch {
    return null
  }
}

export async function register(req: Request, res: Response) {
  const session = await authService.register(req.body as RegisterInput)
  return sendSession(res, session, {
    statusCode: HTTP_STATUS.CREATED,
    message: MESSAGES.ACCOUNT_CREATED,
  })
}

export async function login(req: Request, res: Response) {
  const session = await authService.login(req.body as LoginInput)
  return sendSession(res, session, { message: MESSAGES.SIGNED_IN })
}

export async function logout(req: Request, res: Response) {
  const userId = await resolveLogoutUserId(req)

  if (userId) {
    await authService.logout(userId)
  }

  clearRefreshCookie(res)
  return sendSuccess(res, { message: MESSAGES.LOGGED_OUT })
}

export async function me(req: Request, res: Response) {
  if (!req.auth) {
    throw AppError.unauthorized()
  }

  const user = await authService.getCurrentUser(req.auth.userId)
  return sendSuccess(res, { data: { user } })
}

export async function refresh(req: Request, res: Response) {
  try {
    const session = await authService.refreshSession(readIncomingRefreshToken(req))
    return sendSession(res, session, { message: MESSAGES.TOKEN_REFRESHED })
  } catch (error) {
    clearRefreshCookie(res)
    throw error
  }
}

export async function forgotPassword(req: Request, res: Response) {
  await authService.forgotPassword(req.body as ForgotPasswordInput)
  return sendSuccess(res, { message: MESSAGES.RESET_EMAIL_SENT })
}

export async function resetPassword(req: Request, res: Response) {
  const session = await authService.resetPassword(req.body as ResetPasswordInput)
  return sendSession(res, session, { message: MESSAGES.PASSWORD_RESET })
}

export async function changePassword(req: Request, res: Response) {
  if (!req.auth) {
    throw AppError.unauthorized()
  }

  const session = await authService.changePassword(
    req.auth.userId,
    req.body as ChangePasswordInput
  )
  return sendSession(res, session, { message: MESSAGES.PASSWORD_CHANGED })
}
