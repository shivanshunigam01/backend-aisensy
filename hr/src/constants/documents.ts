export const DOCUMENT_TYPES = [
  "resume",
  "offer_letter",
  "id_proof",
  "education",
  "experience",
  "other",
] as const

export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const DOCUMENT_STATUSES = ["active", "expiring", "expired"] as const

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024

export const DOCUMENT_EXPIRING_DAYS = 30

export const DOCUMENT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const

export const DOCUMENT_ALLOWED_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".doc",
  ".docx",
] as const
