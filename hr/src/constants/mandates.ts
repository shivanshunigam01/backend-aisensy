export const MANDATE_WORK_MODES = ["ONSITE", "HYBRID", "REMOTE"] as const
export type MandateWorkMode = (typeof MANDATE_WORK_MODES)[number]

export const MANDATE_FEE_TYPES = ["FIXED", "PERCENTAGE"] as const
export type MandateFeeType = (typeof MANDATE_FEE_TYPES)[number]

export const MANDATE_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const
export type MandatePriority = (typeof MANDATE_PRIORITIES)[number]

/**
 * OPEN remains the historical "approved for sourcing" status.
 * APPROVED is an explicit starter-kit alias; both allow sourcing/submission.
 */
export const MANDATE_STATUSES = [
  "DRAFT",
  "APPROVED",
  "OPEN",
  "ON_HOLD",
  "FILLED",
  "CANCELLED",
  "CLOSED",
] as const
export type MandateStatus = (typeof MANDATE_STATUSES)[number]

export const MANDATE_SOURCING_STATUSES = ["APPROVED", "OPEN"] as const satisfies readonly MandateStatus[]

export function isMandateOpenForSourcing(status: string) {
  return (MANDATE_SOURCING_STATUSES as readonly string[]).includes(status)
}

export const MANDATE_WORK_MODE_LABELS: Record<MandateWorkMode, string> = {
  ONSITE: "On-site",
  HYBRID: "Hybrid",
  REMOTE: "Remote",
}

export const MANDATE_PRIORITY_LABELS: Record<MandatePriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
}

export const MANDATE_STATUS_LABELS: Record<MandateStatus, string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  OPEN: "Open",
  ON_HOLD: "On hold",
  FILLED: "Filled",
  CANCELLED: "Cancelled",
  CLOSED: "Closed",
}

export const DEFAULT_SALARY_CURRENCY = "INR"
