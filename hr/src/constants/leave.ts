export const LEAVE_REQUEST_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const

export type LeaveRequestStatus = (typeof LEAVE_REQUEST_STATUSES)[number]

export const ACTIVE_LEAVE_REQUEST_STATUSES = ["pending", "approved"] as const

export const DEFAULT_LEAVE_TYPES = [
  { name: "Annual", code: "ANNUAL", maxDays: 18, isPaid: true },
  { name: "Sick", code: "SICK", maxDays: 12, isPaid: true },
  { name: "Casual", code: "CASUAL", maxDays: 7, isPaid: true },
  { name: "Parental", code: "PARENTAL", maxDays: 90, isPaid: true },
  { name: "Unpaid", code: "UNPAID", maxDays: 30, isPaid: false },
  { name: "Comp-off", code: "COMP", maxDays: 5, isPaid: true },
] as const
