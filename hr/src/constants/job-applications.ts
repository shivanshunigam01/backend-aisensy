export const JOB_APPLICATION_SOURCES = ["CAREER_PAGE"] as const
export type JobApplicationSource = (typeof JOB_APPLICATION_SOURCES)[number]

export const JOB_APPLICATION_STATUSES = [
  "APPLIED",
  "RESUME_SCREENING",
  "AI_INTERVIEW_PENDING",
  "AI_INTERVIEW_COMPLETED",
  "AI_INTERVIEW_PASSED",
  "AI_INTERVIEW_FAILED",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "REJECTED",
  "WITHDRAWN",
] as const
export type JobApplicationStatus = (typeof JOB_APPLICATION_STATUSES)[number]

export const JOB_APPLICATION_STATUS_LABELS: Record<JobApplicationStatus, string> = {
  APPLIED: "Applied",
  RESUME_SCREENING: "Resume screening",
  AI_INTERVIEW_PENDING: "AI interview pending",
  AI_INTERVIEW_COMPLETED: "AI interview completed",
  AI_INTERVIEW_PASSED: "AI interview passed",
  AI_INTERVIEW_FAILED: "AI interview failed",
  UNDER_REVIEW: "Under review",
  SHORTLISTED: "Shortlisted",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
}
