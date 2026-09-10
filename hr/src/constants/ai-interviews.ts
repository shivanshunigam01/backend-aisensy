export const AI_INTERVIEW_STATUSES = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "EXPIRED",
  "CANCELLED",
] as const
export type AiInterviewStatus = (typeof AI_INTERVIEW_STATUSES)[number]

export const AI_INTERVIEW_STATUS_LABELS: Record<AiInterviewStatus, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
}

export const AI_INTERVIEW_RESULTS = ["PENDING", "PASSED", "FAILED"] as const
export type AiInterviewResult = (typeof AI_INTERVIEW_RESULTS)[number]

export const AI_INTERVIEW_RESULT_LABELS: Record<AiInterviewResult, string> = {
  PENDING: "Pending",
  PASSED: "Passed",
  FAILED: "Failed",
}

export const AI_INTERVIEW_JOB_TYPES = ["MANDATE", "JOB"] as const
export type AiInterviewJobType = (typeof AI_INTERVIEW_JOB_TYPES)[number]

export const AI_QUESTION_CATEGORIES = [
  "TECHNICAL",
  "EXPERIENCE",
  "PROBLEM_SOLVING",
  "ARCHITECTURE",
  "BEHAVIORAL",
] as const
export type AiQuestionCategory = (typeof AI_QUESTION_CATEGORIES)[number]

export const AI_QUESTION_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const
export type AiQuestionDifficulty = (typeof AI_QUESTION_DIFFICULTIES)[number]

export const DEFAULT_PASSING_SCORE = 70
export const DEFAULT_INTERVIEW_EXPIRY_HOURS = 72
export const DEFAULT_INTERVIEW_DURATION_MINUTES = 30
export const AI_INTERVIEW_QUESTION_COUNT = 5

export const AI_INTERVIEW_MODES = ["TEXT", "VOICE", "BOTH"] as const
export type AiInterviewMode = (typeof AI_INTERVIEW_MODES)[number]

export const AI_INTERVIEW_MODE_LABELS: Record<AiInterviewMode, string> = {
  TEXT: "Text only",
  VOICE: "Voice only",
  BOTH: "Text and voice",
}
