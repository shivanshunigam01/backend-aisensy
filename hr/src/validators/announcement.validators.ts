import { z } from "zod"

import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_VISIBILITIES,
} from "../constants/announcements.js"
import { USER_ROLE_VALUES } from "../constants/roles.js"
import { listControlFields } from "./list-query.js"

const emptyToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform(emptyToUndefined)
  .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Use YYYY-MM-DD",
  })

const audienceSchema = z.array(z.enum(USER_ROLE_VALUES)).max(4).default([])

export const announcementWriteSchema = z.object({
  title: z.string().trim().min(3, "Enter a title").max(160),
  content: z.string().trim().min(8, "Enter the announcement").max(8000),
  category: z.enum(ANNOUNCEMENT_CATEGORIES),
  priority: z.enum(ANNOUNCEMENT_PRIORITIES).optional(),
  publishDate: optionalDate,
  expiryDate: optionalDate,
  targetAudience: audienceSchema.optional(),
  publish: z.boolean().optional(),
})

export const updateAnnouncementSchema = announcementWriteSchema.partial()

export const announcementListQuerySchema = z.object({
  category: z.enum(ANNOUNCEMENT_CATEGORIES).optional(),
  priority: z.enum(ANNOUNCEMENT_PRIORITIES).optional(),
  visibility: z.enum(ANNOUNCEMENT_VISIBILITIES).optional(),
  ...listControlFields(["publishDate", "createdAt", "title", "priority"] as const, 12),
})

export type AnnouncementWriteInput = z.infer<typeof announcementWriteSchema>
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>
export type AnnouncementListQueryInput = z.infer<typeof announcementListQuerySchema>
