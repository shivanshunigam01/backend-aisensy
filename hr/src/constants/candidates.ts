export const CANDIDATE_SOURCES = [
  "LINKEDIN",
  "NAUKRI",
  "REFERRAL",
  "WEBSITE",
  "DIRECT",
  "CONSULTANT",
  "OTHER",
] as const

export type CandidateSource = (typeof CANDIDATE_SOURCES)[number]

export const CANDIDATE_STATUSES = [
  "NEW",
  "SCREENING",
  "ACTIVE",
  "SUBMITTED",
  "INTERVIEWING",
  "OFFERED",
  "HIRED",
  "REJECTED",
  "ON_HOLD",
] as const

export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number]

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  NEW: "New",
  SCREENING: "Screening",
  ACTIVE: "Active",
  SUBMITTED: "Submitted",
  INTERVIEWING: "Interviewing",
  OFFERED: "Offered",
  HIRED: "Hired",
  REJECTED: "Rejected",
  ON_HOLD: "On hold",
}

export const CANDIDATE_SOURCE_LABELS: Record<CandidateSource, string> = {
  LINKEDIN: "LinkedIn",
  NAUKRI: "Naukri",
  REFERRAL: "Referral",
  WEBSITE: "Website",
  DIRECT: "Direct",
  CONSULTANT: "Consultant",
  OTHER: "Other",
}

export const CANDIDATE_CONSENT_METHODS = ["FORM", "EMAIL", "WHATSAPP", "VERBAL", "OTHER"] as const
export type CandidateConsentMethod = (typeof CANDIDATE_CONSENT_METHODS)[number]

export const CANDIDATE_CONSENT_METHOD_LABELS: Record<CandidateConsentMethod, string> = {
  FORM: "Form",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  VERBAL: "Verbal",
  OTHER: "Other",
}

export const CANDIDATE_CONSENT_PURPOSES = [
  "SOURCING",
  "SUBMISSION",
  "INTERVIEW",
  "BACKGROUND_CHECK",
  "TALENT_POOL",
  "OTHER",
] as const
export type CandidateConsentPurpose = (typeof CANDIDATE_CONSENT_PURPOSES)[number]

export const CANDIDATE_CONSENT_PURPOSE_LABELS: Record<CandidateConsentPurpose, string> = {
  SOURCING: "Sourcing",
  SUBMISSION: "Client submission",
  INTERVIEW: "Interview process",
  BACKGROUND_CHECK: "Background check",
  TALENT_POOL: "Talent pool",
  OTHER: "Other",
}
