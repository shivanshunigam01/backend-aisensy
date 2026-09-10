const WEEKDAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

export function dateKeyInTimeZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function utcDateFromKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`)
}

export function addUtcDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function weekdayKey(date: Date) {
  return (
    ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][
      date.getUTCDay()
    ] ?? "monday"
  )
}

export function lastWorkingDateKeys(count: number, todayKey: string, workingDays: string[]) {
  const allowed = new Set(workingDays.map((day) => day.toLowerCase()))
  const keys: string[] = []
  let cursor = utcDateFromKey(todayKey)
  let steps = 0

  while (keys.length < count && steps < count * 4 + 14) {
    const key = cursor.toISOString().slice(0, 10)
    if (allowed.size === 0 || allowed.has(weekdayKey(cursor))) {
      keys.unshift(key)
    }
    cursor = addUtcDays(cursor, -1)
    steps += 1
  }

  return keys
}

export function monthEndKeys(count: number, todayKey: string) {
  const today = utcDateFromKey(todayKey)
  const keys: { key: string; label: string; end: Date }[] = []

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1))
    const end =
      offset === 0
        ? today
        : new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0))

    keys.push({
      key: end.toISOString().slice(0, 10),
      label: new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(cursor),
      end,
    })
  }

  return keys
}

export function formatDayLabel(dateKey: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(utcDateFromKey(dateKey))
}

export function relativeDayLabel(dateKey: string, todayKey: string) {
  const diff = Math.round(
    (utcDateFromKey(dateKey).getTime() - utcDateFromKey(todayKey).getTime()) / 86_400_000
  )

  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  if (diff === -1) return "Yesterday"
  if (diff > 1 && diff < 7) {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      timeZone: "UTC",
    }).format(utcDateFromKey(dateKey))
  }
  if (diff >= 7) return `In ${diff} days`
  return `${Math.abs(diff)} days ago`
}

export function relativeTimeLabel(from: Date, now = new Date()) {
  const minutes = Math.max(0, Math.round((now.getTime() - from.getTime()) / 60_000))
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days}d ago`
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(from)
}

export function dateKeyFromDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function formatShortDate(dateKey: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(utcDateFromKey(dateKey))
}

export function formatLeaveRange(startKey: string, endKey: string) {
  if (startKey === endKey) {
    return formatShortDate(startKey)
  }

  const start = utcDateFromKey(startKey)
  const end = utcDateFromKey(endKey)
  const startMonth = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(
    start
  )
  const endMonth = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(end)

  if (start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth()) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${endMonth}`
  }

  return `${start.getUTCDate()} ${startMonth}–${end.getUTCDate()} ${endMonth}`
}

export function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function leaveTypeLabel(type: string) {
  const labels: Record<string, string> = {
    annual: "Annual",
    sick: "Sick",
    casual: "Casual",
    parental: "Parental",
    unpaid: "Unpaid",
    compensatory: "Comp-off",
    remote: "Remote day",
  }
  return labels[type] ?? type
}

export function timePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)

  const map = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  )

  return {
    weekday: map.weekday ?? "",
    year: map.year ?? "",
    month: map.month ?? "",
    day: map.day ?? "",
    hour: map.hour ?? "00",
    minute: map.minute ?? "00",
    second: map.second ?? "00",
    dateKey: `${map.year}-${map.month}-${map.day}`,
  }
}

export function formatTimeInTimeZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date)
}

export function parseHHmmMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

export function expectedWorkingMinutes(start: string, end: string) {
  return Math.max(0, parseHHmmMinutes(end) - parseHHmmMinutes(start))
}

export function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  )
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  )

  return asUtc - date.getTime()
}

export function zonedDateTime(dateKey: string, hhmm: string, timeZone: string) {
  const [year = 1970, month = 1, day = 1] = dateKey.split("-").map(Number)
  const [hour = 0, minute = 0] = hhmm.split(":").map(Number)
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  const offset = getTimeZoneOffsetMs(guess, timeZone)
  let actual = new Date(guess.getTime() - offset)
  const adjusted = getTimeZoneOffsetMs(actual, timeZone)

  if (adjusted !== offset) {
    actual = new Date(guess.getTime() - adjusted)
  }

  return actual
}

export function isWorkingDateKey(dateKey: string, workingDays: string[]) {
  const allowed = new Set(workingDays.map((day) => day.toLowerCase()))
  return allowed.has(weekdayKey(utcDateFromKey(dateKey)))
}

export function monthDateKeys(month: string) {
  const [year = 1970, monthNumber = 1] = month.split("-").map(Number)
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const keys: string[] = []

  for (let day = 1; day <= last; day += 1) {
    keys.push(`${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`)
  }

  return {
    keys,
    start: utcDateFromKey(keys[0] ?? `${month}-01`),
    end: utcDateFromKey(keys[keys.length - 1] ?? `${month}-01`),
  }
}

export function formatDurationMinutes(total: number) {
  const safe = Math.max(0, Math.round(total))
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60

  if (hours <= 0) {
    return `${minutes}m`
  }

  if (minutes === 0) {
    return `${hours}h`
  }

  return `${hours}h ${minutes}m`
}

export function countLeaveDays(
  startKey: string,
  endKey: string,
  workingDays: string[],
  holidayKeys: Set<string>
) {
  let count = 0
  let cursor = utcDateFromKey(startKey)
  const end = utcDateFromKey(endKey)

  while (cursor.getTime() <= end.getTime()) {
    const key = dateKeyFromDate(cursor)
    if (isWorkingDateKey(key, workingDays) && !holidayKeys.has(key)) {
      count += 1
    }
    cursor = addUtcDays(cursor, 1)
  }

  return count
}

export { WEEKDAY_INDEX }
