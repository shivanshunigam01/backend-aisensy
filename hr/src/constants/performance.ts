export const GOAL_STATUSES = ["not_started", "in_progress", "completed", "cancelled"] as const

export type GoalStatus = (typeof GOAL_STATUSES)[number]

export const REVIEW_STATUSES = ["draft", "submitted"] as const

export type ReviewStatus = (typeof REVIEW_STATUSES)[number]

export const REVIEW_KINDS = ["self", "manager"] as const

export type ReviewKind = (typeof REVIEW_KINDS)[number]

export const PERFORMANCE_RATINGS = [1, 2, 3, 4, 5] as const

export type PerformanceRating = (typeof PERFORMANCE_RATINGS)[number]

export const PERFORMANCE_RATING_LABELS: Record<PerformanceRating, string> = {
  1: "Needs improvement",
  2: "Developing",
  3: "Meets expectations",
  4: "Exceeds expectations",
  5: "Outstanding",
}

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
}

export function statusFromProgress(progress: number, current?: GoalStatus): GoalStatus {
  if (current === "cancelled") return "cancelled"
  if (progress >= 100) return "completed"
  if (progress <= 0) return "not_started"
  return "in_progress"
}
