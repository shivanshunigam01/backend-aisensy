import { randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { DOCUMENT_ALLOWED_EXTENSIONS } from "../constants/documents.js"
import { MESSAGES } from "../constants/messages.js"
import { env } from "../config/env.js"
import { AppError } from "./app-error.js"

const allowedExt = new Set<string>(DOCUMENT_ALLOWED_EXTENSIONS)

export function localUploadsRoot() {
  return path.resolve(process.env.LOCAL_UPLOAD_DIR || path.join(process.cwd(), "uploads"))
}

export function publicFileUrl(storedName: string) {
  return `http://localhost:${env.PORT}${env.API_PREFIX}/public/files/${storedName}`
}

export function isSafeStoredFileName(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]+$/i.test(value)) {
    return false
  }
  return allowedExt.has(path.extname(value).toLowerCase())
}

export function resolveLocalPublicFile(storedName: string) {
  if (!isSafeStoredFileName(storedName)) return null
  const absolute = path.resolve(localUploadsRoot(), "careers", storedName)
  const root = path.resolve(localUploadsRoot(), "careers")
  if (!absolute.startsWith(`${root}${path.sep}`)) return null
  return absolute
}

export async function saveLocalCareerResume(input: {
  buffer: Buffer
  organizationId: string
  filename: string
  mimeType: string
}) {
  const ext = path.extname(input.filename).toLowerCase()
  if (!allowedExt.has(ext)) {
    throw AppError.badRequest(MESSAGES.DOCUMENT_TYPE_INVALID)
  }
  const storedName = `${randomUUID()}${ext}`
  const dest = path.join(localUploadsRoot(), "careers", storedName)
  await mkdir(path.dirname(dest), { recursive: true })
  await writeFile(dest, input.buffer)

  return {
    publicId: `local:careers/${storedName}`,
    fileUrl: publicFileUrl(storedName),
    fileName: input.filename,
  }
}
