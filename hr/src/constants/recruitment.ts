import { EMPLOYMENT_TYPES } from "./employees.js"

export const JOB_STATUSES = ["open", "paused", "closed"] as const

export type JobStatus = (typeof JOB_STATUSES)[number]

export const JOB_EMPLOYMENT_TYPES = EMPLOYMENT_TYPES

export const APPLICATION_STAGES = [
  "applied",
  "screening",
  "interview",
  "technical",
  "hr_round",
  "hired",
  "rejected",
] as const

export type ApplicationStage = (typeof APPLICATION_STAGES)[number]

export const KANBAN_STAGES = [
  "applied",
  "screening",
  "interview",
  "technical",
  "hr_round",
  "hired",
] as const satisfies readonly Exclude<ApplicationStage, "rejected">[]

export const APPLICATION_STAGE_LABELS: Record<ApplicationStage, string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  technical: "Technical",
  hr_round: "HR Round",
  hired: "Hired",
  rejected: "Rejected",
}
