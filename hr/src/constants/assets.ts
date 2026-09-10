export const ASSET_STATUSES = ["available", "assigned", "maintenance", "retired"] as const

export type AssetStatus = (typeof ASSET_STATUSES)[number]

export const ASSET_CONDITIONS = ["new", "good", "fair", "poor"] as const

export type AssetCondition = (typeof ASSET_CONDITIONS)[number]

export const ASSET_CATEGORIES = [
  "laptop",
  "monitor",
  "phone",
  "tablet",
  "accessories",
  "furniture",
  "badge",
  "vehicle",
  "other",
] as const

export type AssetCategory = (typeof ASSET_CATEGORIES)[number]

export const ASSIGNMENT_STATUSES = ["active", "returned"] as const

export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number]
