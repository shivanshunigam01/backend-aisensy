export const REPORT_TYPES = [
  "employee-growth",
  "attendance",
  "leave",
  "department",
  "recruitment",
  "payroll",
] as const

export type ReportType = (typeof REPORT_TYPES)[number]

export const REPORT_MAX_RANGE_DAYS = 731

export const ATTENDANCE_DAILY_MAX_DAYS = 62
