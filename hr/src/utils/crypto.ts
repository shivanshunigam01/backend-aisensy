import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

export function createRandomToken(bytes = 32) {
  return randomBytes(bytes).toString("hex")
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function tokensMatch(token: string, hashed: string) {
  const incoming = Buffer.from(hashToken(token))
  const stored = Buffer.from(hashed)

  if (incoming.length !== stored.length) {
    return false
  }

  return timingSafeEqual(incoming, stored)
}
