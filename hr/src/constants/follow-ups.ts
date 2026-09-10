export const FOLLOW_UP_TYPES = ["CALL", "EMAIL", "MESSAGE", "MEETING"] as const

export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number]

export const FOLLOW_UP_TYPE_LABELS: Record<FollowUpType, string> = {
  CALL: "Call",
  EMAIL: "Email",
  MESSAGE: "Message",
  MEETING: "Meeting",
}

export const FOLLOW_UP_CANDIDATE_STATUSES = [
  "CONFIRMED",
  "POSITIVE",
  "UNDECIDED",
  "CONCERNED",
  "DROPPING",
  "UNREACHABLE",
] as const

export type FollowUpCandidateStatus = (typeof FOLLOW_UP_CANDIDATE_STATUSES)[number]

export const FOLLOW_UP_CANDIDATE_STATUS_LABELS: Record<FollowUpCandidateStatus, string> = {
  CONFIRMED: "Confirmed",
  POSITIVE: "Positive",
  UNDECIDED: "Undecided",
  CONCERNED: "Concerned",
  DROPPING: "Dropping",
  UNREACHABLE: "Unreachable",
}

export const FOLLOW_UP_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const

export type FollowUpRiskLevel = (typeof FOLLOW_UP_RISK_LEVELS)[number]

export const FOLLOW_UP_RISK_LEVEL_LABELS: Record<FollowUpRiskLevel, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
}

export const JOINING_PROBABILITY_MIN = 0
export const JOINING_PROBABILITY_MAX = 10
