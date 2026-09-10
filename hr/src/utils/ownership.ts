import {
  DEFAULT_OWNERSHIP_PERIOD_MONTHS,
} from "../constants/agreements.js"
import { addUtcDays, dateKeyFromDate } from "./dates.js"

export const OWNERSHIP_STATUSES = ["ACTIVE", "EXPIRED", "DISPUTED"] as const
export type OwnershipStatus = (typeof OWNERSHIP_STATUSES)[number]

export function addMonthsUtc(start: Date, months: number) {
  const next = new Date(start)
  const day = next.getUTCDate()
  next.setUTCMonth(next.getUTCMonth() + Math.max(0, Math.floor(months)))
  // Clamp overflow (e.g. Jan 31 + 1 month)
  if (next.getUTCDate() < day) {
    next.setUTCDate(0)
  }
  return next
}

export function calculateOwnershipWindow(
  submittedAt: Date,
  ownershipPeriodMonths?: number | null
) {
  const months =
    ownershipPeriodMonths === undefined || ownershipPeriodMonths === null
      ? DEFAULT_OWNERSHIP_PERIOD_MONTHS
      : Math.max(0, Number(ownershipPeriodMonths) || 0)

  const ownershipStartDate = new Date(submittedAt)
  const ownershipEndDate = addMonthsUtc(ownershipStartDate, months)
  return { ownershipStartDate, ownershipEndDate, ownershipPeriodMonths: months }
}

export function resolveOwnershipStatus(input: {
  ownershipStartDate?: Date | null
  ownershipEndDate?: Date | null
  disputed?: boolean
  now?: Date
}): OwnershipStatus {
  if (input.disputed) return "DISPUTED"
  if (!input.ownershipStartDate || !input.ownershipEndDate) return "EXPIRED"
  const now = input.now ?? new Date()
  const today = dateKeyFromDate(now)
  const end = dateKeyFromDate(input.ownershipEndDate)
  if (today > end) return "EXPIRED"
  return "ACTIVE"
}

/** Convenience: extend end date by calendar days when needed. */
export function extendOwnershipEnd(end: Date, extraDays: number) {
  return addUtcDays(end, extraDays)
}
