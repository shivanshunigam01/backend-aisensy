export const JOINING_CONFIRMATION_STATUSES = [
  "EXPECTED",
  "CONFIRMED",
  "JOINED",
  "NO_SHOW",
  "WITHDRAWN",
] as const

export type JoiningConfirmationStatus = (typeof JOINING_CONFIRMATION_STATUSES)[number]

export const JOINING_CONFIRMATION_STATUS_LABELS: Record<JoiningConfirmationStatus, string> = {
  EXPECTED: "Expected",
  CONFIRMED: "Confirmed",
  JOINED: "Joined",
  NO_SHOW: "No show",
  WITHDRAWN: "Withdrawn",
}

export const JOINING_CONFIRMED_STATUSES = ["CONFIRMED", "JOINED"] as const satisfies readonly JoiningConfirmationStatus[]

export function isConfirmedJoiningStatus(status: string) {
  return (JOINING_CONFIRMED_STATUSES as readonly string[]).includes(status)
}
