import type { CookieOptions, Response } from "express"

import { env, isProduction } from "../config/env.js"
import { AUTH_COOKIE } from "../constants/auth.js"

function refreshCookiePath() {
  return `${env.API_PREFIX}/auth`
}

function cookieOptions(): CookieOptions {
  const sameSite = env.COOKIE_SAMESITE
  const domain = env.COOKIE_DOMAIN.trim()

  return {
    httpOnly: true,
    secure: isProduction || sameSite === "none",
    sameSite,
    path: refreshCookiePath(),
    maxAge: env.REFRESH_COOKIE_MAX_AGE_MS,
    ...(domain ? { domain } : {}),
  }
}

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE.name, token, cookieOptions())
}

export function clearRefreshCookie(res: Response) {
  const { maxAge: _maxAge, ...options } = cookieOptions()
  res.clearCookie(AUTH_COOKIE.name, options)
}

export function readRefreshCookie(req: { cookies?: Record<string, string | undefined> }) {
  return req.cookies?.[AUTH_COOKIE.name]
}
