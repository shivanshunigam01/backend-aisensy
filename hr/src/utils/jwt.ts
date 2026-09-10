import jwt, { type SignOptions } from "jsonwebtoken"

import { env } from "../config/env.js"
import { AppError } from "./app-error.js"
import { createRandomToken } from "./crypto.js"
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  UserRole,
} from "../types/auth.js"

type TokenUser = {
  id: string
  organizationId: string
  role: UserRole
}

export function signAccessToken(user: TokenUser) {
  const payload: AccessTokenPayload = {
    sub: user.id,
    organizationId: user.organizationId,
    role: user.role,
    typ: "access",
  }

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  })
}

export function signRefreshToken(user: TokenUser) {
  const payload: RefreshTokenPayload = {
    sub: user.id,
    typ: "refresh",
    jti: createRandomToken(16),
  }

  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  })
}

function readPayload(token: string, secret: string) {
  try {
    const decoded = jwt.verify(token, secret, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    })

    if (typeof decoded === "string" || !decoded.sub) {
      throw AppError.unauthorized("Invalid token")
    }

    return decoded
  } catch (error) {
    if (error instanceof AppError) {
      throw error
    }

    if (error instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized("Token expired")
    }

    throw AppError.unauthorized("Invalid token")
  }
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = readPayload(token, env.JWT_ACCESS_SECRET)

  if (
    payload.typ !== "access" ||
    typeof payload.sub !== "string" ||
    typeof payload.organizationId !== "string"
  ) {
    throw AppError.unauthorized("Invalid token")
  }

  return {
    sub: payload.sub,
    organizationId: payload.organizationId,
    role: payload.role as UserRole,
    typ: "access",
  }
}

export function getAccessTokenExpiresAt(token: string): string {
  const decoded = jwt.decode(token)

  if (decoded && typeof decoded === "object" && typeof decoded.exp === "number") {
    return new Date(decoded.exp * 1000).toISOString()
  }

  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const payload = readPayload(token, env.JWT_REFRESH_SECRET)

  if (
    payload.typ !== "refresh" ||
    typeof payload.sub !== "string" ||
    typeof payload.jti !== "string"
  ) {
    throw AppError.unauthorized("Invalid token")
  }

  return {
    sub: payload.sub,
    typ: "refresh",
    jti: payload.jti,
  }
}
