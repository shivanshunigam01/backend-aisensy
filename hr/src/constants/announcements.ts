export const ANNOUNCEMENT_CATEGORIES = [
  "general",
  "event",
  "policy",
  "important",
  "celebration",
] as const

export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number]

export const ANNOUNCEMENT_PRIORITIES = ["normal", "high", "urgent"] as const

export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number]

export const ANNOUNCEMENT_VISIBILITIES = ["draft", "scheduled", "live", "expired"] as const

export type AnnouncementVisibility = (typeof ANNOUNCEMENT_VISIBILITIES)[number]
