import { addUtcDays, dateKeyFromDate, utcDateFromKey, weekdayKey } from "./dates.js"

const DEFAULT_WORKING_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"]

/**
 * Add N working days to a start date (start day itself is not counted).
 * Weekends (Sat/Sun) are skipped unless custom workingDays are provided.
 */
export function addWorkingDays(
  start: Date,
  workingDaysCount: number,
  workingDays: string[] = DEFAULT_WORKING_DAYS
) {
  const allowed = new Set(workingDays.map((d) => d.toLowerCase()))
  let cursor = new Date(start)
  let remaining = Math.max(0, Math.floor(workingDaysCount))
  let guard = 0

  while (remaining > 0 && guard < remaining * 4 + 60) {
    cursor = addUtcDays(cursor, 1)
    if (allowed.has(weekdayKey(cursor))) {
      remaining -= 1
    }
    guard += 1
  }

  return cursor
}

export function addWorkingDaysFromKey(
  startKey: string,
  workingDaysCount: number,
  workingDays: string[] = DEFAULT_WORKING_DAYS
) {
  return addWorkingDays(utcDateFromKey(startKey), workingDaysCount, workingDays)
}

export function isPastWorkingDayDeadline(deadline: Date, now = new Date()) {
  return dateKeyFromDate(now) > dateKeyFromDate(deadline)
}
