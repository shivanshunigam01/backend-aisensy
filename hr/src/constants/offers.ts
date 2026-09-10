export const OFFER_STATUSES = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
] as const

export type OfferStatus = (typeof OFFER_STATUSES)[number]

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  EXPIRED: "Expired",
}

export const OFFER_ACTIVE_STATUSES = ["DRAFT", "SENT", "ACCEPTED"] as const satisfies readonly OfferStatus[]

export function isActiveOfferStatus(status: string) {
  return (OFFER_ACTIVE_STATUSES as readonly string[]).includes(status)
}

export const JOINING_STATUSES = ["PENDING", "JOINED", "NO_SHOW", "WITHDRAWN"] as const

export type JoiningStatus = (typeof JOINING_STATUSES)[number]

export const JOINING_STATUS_LABELS: Record<JoiningStatus, string> = {
  PENDING: "Pending",
  JOINED: "Joined",
  NO_SHOW: "No show",
  WITHDRAWN: "Withdrawn",
}
