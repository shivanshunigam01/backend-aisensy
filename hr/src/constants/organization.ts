export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const

export type Weekday = (typeof WEEKDAYS)[number]

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"] as const

export type CompanySize = (typeof COMPANY_SIZES)[number]

export const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const

export const DEFAULT_WORKING_DAYS: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
]

export const DEFAULT_WORKING_HOURS = {
  start: "09:00",
  end: "18:00",
} as const

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
