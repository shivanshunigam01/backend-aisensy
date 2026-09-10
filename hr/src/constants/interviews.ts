export const INTERVIEW_TYPES = ["PHONE", "VIDEO", "IN_PERSON", "ONLINE"] as const

export type InterviewType = (typeof INTERVIEW_TYPES)[number]

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  PHONE: "Phone",
  VIDEO: "Video",
  IN_PERSON: "In person",
  ONLINE: "Online",
}

export const INTERVIEW_STATUSES = [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "RESCHEDULED",
] as const

export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number]

export const INTERVIEW_STATUS_LABELS: Record<InterviewStatus, string> = {
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
  RESCHEDULED: "Rescheduled",
}

/** SELECT aliases SELECTED for starter-kit naming; both accepted. HOLD aliases ON_HOLD. */
export const INTERVIEW_DECISIONS = [
  "SELECTED",
  "SELECT",
  "NEXT_ROUND",
  "REJECTED",
  "REJECT",
  "ON_HOLD",
  "HOLD",
] as const

export type InterviewDecision = (typeof INTERVIEW_DECISIONS)[number]

export const INTERVIEW_DECISION_LABELS: Record<InterviewDecision, string> = {
  SELECTED: "Select",
  SELECT: "Select",
  NEXT_ROUND: "Next round",
  REJECTED: "Reject",
  REJECT: "Reject",
  ON_HOLD: "Hold",
  HOLD: "Hold",
}

export function normalizeInterviewDecision(value: string | undefined | null): InterviewDecision | "" {
  switch (value) {
    case "SELECT":
      return "SELECTED"
    case "REJECT":
      return "REJECTED"
    case "HOLD":
      return "ON_HOLD"
    case "SELECTED":
    case "NEXT_ROUND":
    case "REJECTED":
    case "ON_HOLD":
      return value
    default:
      return ""
  }
}

export const INTERVIEW_FEEDBACK_FIELDS = [
  "technicalScore",
  "communicationScore",
  "cultureFitScore",
  "leadershipScore",
  "compensationFit",
  "joiningRisk",
] as const

export type InterviewFeedbackField = (typeof INTERVIEW_FEEDBACK_FIELDS)[number]

export const INTERVIEW_FEEDBACK_LABELS: Record<InterviewFeedbackField, string> = {
  technicalScore: "Technical",
  communicationScore: "Communication",
  cultureFitScore: "Culture fit",
  leadershipScore: "Leadership",
  compensationFit: "Compensation fit",
  joiningRisk: "Joining risk",
}

export const INTERVIEW_SCORE_MIN = 0
export const INTERVIEW_SCORE_MAX = 10
export const INTERVIEW_DURATION_MIN = 15
export const INTERVIEW_DURATION_MAX = 480
export const INTERVIEW_DURATION_DEFAULT = 60
