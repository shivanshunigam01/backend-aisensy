export const GUARANTEE_MILESTONE_STATUSES = [
  "PENDING",
  "COMPLETED",
  "AT_RISK",
  "FAILED",
] as const

export type GuaranteeMilestoneStatus = (typeof GUARANTEE_MILESTONE_STATUSES)[number]

export const GUARANTEE_MILESTONE_STATUS_LABELS: Record<GuaranteeMilestoneStatus, string> = {
  PENDING: "Pending",
  COMPLETED: "Completed",
  AT_RISK: "At risk",
  FAILED: "Failed",
}

export const RETENTION_STATUSES = [
  "IN_PROGRESS",
  "ON_TRACK",
  "AT_RISK",
  "RETAINED",
  "REPLACED",
  "DROPPED",
] as const

export type RetentionStatus = (typeof RETENTION_STATUSES)[number]

export const RETENTION_STATUS_LABELS: Record<RetentionStatus, string> = {
  IN_PROGRESS: "In progress",
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  RETAINED: "Retained",
  REPLACED: "Replaced",
  DROPPED: "Dropped",
}

export const DEFAULT_GUARANTEE_DAYS = 90
