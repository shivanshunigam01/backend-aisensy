import bcrypt from "bcrypt"

import { env } from "../config/env.js"

/**
 * Precomputed bcrypt hash used only so login still performs a compare when no
 * user exists. Never stored on an account and never a valid password.
 */
export const DUMMY_PASSWORD_HASH =
  "$2b$12$P7Yo5vv0L25sQtvtsRrZwumP4k5wTuV7B/gvmiHgs1cHDtF5NpU0e"

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, env.BCRYPT_SALT_ROUNDS)
}

export async function verifyPassword(plain: string, hashed: string) {
  return bcrypt.compare(plain, hashed)
}
