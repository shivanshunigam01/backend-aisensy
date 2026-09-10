export const ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "late",
  "half_day",
  "wfh",
  "holiday",
  "leave",
] as const

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

export const PRESENT_LIKE_STATUSES = ["present", "late", "half_day", "wfh"] as const

export type PresentLikeStatus = (typeof PRESENT_LIKE_STATUSES)[number]

export const ATTENDANCE_SESSION_STATUSES = [
  "not_started",
  "working",
  "on_break",
  "checked_out",
  "on_leave",
  "holiday",
] as const

export type AttendanceSessionStatus = (typeof ATTENDANCE_SESSION_STATUSES)[number]

export const LATE_GRACE_MINUTES = 10
export const HALF_DAY_RATIO = 0.5
