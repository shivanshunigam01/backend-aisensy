export const CLIENT_STATUSES = ["LEAD", "ACTIVE", "INACTIVE", "CLOSED"] as const
export type ClientStatus = (typeof CLIENT_STATUSES)[number]

export const CLIENT_ONBOARDING_STATUSES = ["PENDING", "COMPLETED", "REJECTED"] as const
export type ClientOnboardingStatus = (typeof CLIENT_ONBOARDING_STATUSES)[number]

export const CLIENT_KYC_STATUSES = ["PENDING", "VERIFIED", "REJECTED"] as const
export type ClientKycStatus = (typeof CLIENT_KYC_STATUSES)[number]

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  LEAD: "Lead",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  CLOSED: "Closed",
}

export const CLIENT_ONBOARDING_LABELS: Record<ClientOnboardingStatus, string> = {
  PENDING: "Onboarding pending",
  COMPLETED: "Onboarding complete",
  REJECTED: "Onboarding rejected",
}

export const CLIENT_KYC_LABELS: Record<ClientKycStatus, string> = {
  PENDING: "KYC pending",
  VERIFIED: "KYC verified",
  REJECTED: "KYC rejected",
}
