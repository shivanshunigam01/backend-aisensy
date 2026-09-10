export const SUBMISSION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "REJECTED",
  "WITHDRAWN",
] as const

export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  SHORTLISTED: "Shortlisted",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
}

export const SUBMISSION_ACTIVE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "SHORTLISTED",
] as const satisfies readonly SubmissionStatus[]

export function isActiveSubmissionStatus(status: string) {
  return (SUBMISSION_ACTIVE_STATUSES as readonly string[]).includes(status)
}

/** Statuses that count as a successful client introduction (ownership trigger). */
export const SUBMISSION_INTRODUCED_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "SHORTLISTED",
] as const satisfies readonly SubmissionStatus[]

export function isIntroducedSubmissionStatus(status: string) {
  return (SUBMISSION_INTRODUCED_STATUSES as readonly string[]).includes(status)
}

/**
 * Client-side duplicate claim statuses.
 * NOT_DUPLICATE aliases UNIQUE for starter-kit naming; both accepted.
 */
export const SUBMISSION_DUPLICATE_STATUSES = [
  "NOT_CHECKED",
  "UNIQUE",
  "NOT_DUPLICATE",
  "POSSIBLE_DUPLICATE",
  "CONFIRMED_DUPLICATE",
  "DISPUTED",
] as const

export type SubmissionDuplicateStatus = (typeof SUBMISSION_DUPLICATE_STATUSES)[number]

export const SUBMISSION_DUPLICATE_STATUS_LABELS: Record<SubmissionDuplicateStatus, string> = {
  NOT_CHECKED: "Not checked",
  UNIQUE: "Unique",
  NOT_DUPLICATE: "Not a duplicate",
  POSSIBLE_DUPLICATE: "Possible duplicate",
  CONFIRMED_DUPLICATE: "Confirmed duplicate",
  DISPUTED: "Disputed",
}

export const OWNERSHIP_STATUSES = ["ACTIVE", "EXPIRED", "DISPUTED"] as const
export type OwnershipStatus = (typeof OWNERSHIP_STATUSES)[number]

export const OWNERSHIP_STATUS_LABELS: Record<OwnershipStatus, string> = {
  ACTIVE: "Active",
  EXPIRED: "Expired",
  DISPUTED: "Disputed",
}

export const FIT_REASONS_MAX = 3
export const FIT_REASON_MAX_LENGTH = 240
export const RISK_GAP_MAX_LENGTH = 500
