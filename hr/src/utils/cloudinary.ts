import { v2 as cloudinary } from "cloudinary"

import { env } from "../config/env.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "./app-error.js"

let configured = false

export function isCloudinaryConfigured() {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET)
}

function ensureCloudinary() {
  if (!isCloudinaryConfigured()) {
    throw AppError.badRequest(MESSAGES.DOCUMENT_STORAGE_NOT_CONFIGURED)
  }

  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    })
    configured = true
  }

  return cloudinary
}

export async function uploadDocumentFile(input: {
  buffer: Buffer
  folder: string
  filename: string
  mimeType: string
}) {
  const client = ensureCloudinary()
  const resourceType = input.mimeType.startsWith("image/") ? "image" : "raw"

  return new Promise<{
    publicId: string
    fileUrl: string
    resourceType: string
    bytes: number
  }>((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        folder: input.folder,
        resource_type: resourceType,
        type: "authenticated",
        use_filename: true,
        unique_filename: true,
        filename_override: input.filename.replace(/\.[^.]+$/, ""),
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Upload failed"))
          return
        }

        resolve({
          publicId: result.public_id,
          fileUrl: result.secure_url,
          resourceType: result.resource_type,
          bytes: result.bytes,
        })
      }
    )

    stream.end(input.buffer)
  })
}

export async function uploadPublicImage(input: {
  buffer: Buffer
  organizationId: string
  filename: string
  mimeType: string
}) {
  const client = ensureCloudinary()

  return new Promise<{
    publicId: string
    fileUrl: string
  }>((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        folder: `${env.CLOUDINARY_FOLDER}/avatars/${input.organizationId}`,
        resource_type: "image",
        type: "upload",
        use_filename: true,
        unique_filename: true,
        filename_override: input.filename.replace(/\.[^.]+$/, ""),
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Upload failed"))
          return
        }

        resolve({
          publicId: result.public_id,
          fileUrl: result.secure_url,
        })
      }
    )

    stream.end(input.buffer)
  })
}

export async function uploadCareerResume(input: {
  buffer: Buffer
  organizationId: string
  filename: string
  mimeType: string
}) {
  const client = ensureCloudinary()
  const resourceType = input.mimeType.startsWith("image/") ? "image" : "raw"

  return new Promise<{
    publicId: string
    fileUrl: string
    fileName: string
  }>((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        folder: `${env.CLOUDINARY_FOLDER}/careers/${input.organizationId}`,
        resource_type: resourceType,
        type: "upload",
        use_filename: true,
        unique_filename: true,
        filename_override: input.filename.replace(/\.[^.]+$/, ""),
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Upload failed"))
          return
        }

        resolve({
          publicId: result.public_id,
          fileUrl: result.secure_url,
          fileName: input.filename,
        })
      }
    )

    stream.end(input.buffer)
  })
}

export function signedDocumentUrl(publicId: string, resourceType: string, expiresInSeconds = 300) {
  const client = ensureCloudinary()
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds

  return {
    url: client.url(publicId, {
      resource_type: resourceType || "raw",
      type: "authenticated",
      sign_url: true,
      expires_at: expiresAt,
      secure: true,
    }),
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  }
}

export async function destroyDocumentFile(publicId: string, resourceType: string) {
  if (!isCloudinaryConfigured()) {
    return
  }

  const client = ensureCloudinary()
  try {
    await client.uploader.destroy(publicId, {
      resource_type: resourceType || "raw",
      type: "authenticated",
    })
  } catch {
    // Cloudinary cleanup is best-effort so a missing file does not block delete.
  }
}
