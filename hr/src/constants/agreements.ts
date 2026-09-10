export const AGREEMENT_FEE_TYPES = ["FIXED", "PERCENTAGE"] as const
export type AgreementFeeType = (typeof AGREEMENT_FEE_TYPES)[number]

export const AGREEMENT_STATUSES = ["DRAFT", "ACTIVE", "EXPIRED", "TERMINATED"] as const
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number]

export const AGREEMENT_FEE_TYPE_LABELS: Record<AgreementFeeType, string> = {
  FIXED: "Fixed fee",
  PERCENTAGE: "Percentage of CTC",
}

export const AGREEMENT_STATUS_LABELS: Record<AgreementStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  EXPIRED: "Expired",
  TERMINATED: "Terminated",
}

/** Starter-kit recommended defaults (existing records may still hold older values). */
export const DEFAULT_PAYMENT_TERMS_DAYS = 15
export const DEFAULT_OWNERSHIP_PERIOD_MONTHS = 12
export const DEFAULT_DUPLICATE_NOTIFICATION_DAYS = 3
export const DEFAULT_REPLACEMENT_PERIOD_DAYS = 90
export const DEFAULT_GST_RATE_PERCENT = 18
