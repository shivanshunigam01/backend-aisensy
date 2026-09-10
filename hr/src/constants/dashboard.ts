export const ACTIVITY_TONES = ["warning", "brand", "success", "default", "muted"] as const

export type ActivityTone = (typeof ACTIVITY_TONES)[number]
