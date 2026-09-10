/**
 * Mandate-centric recruitment pipeline stages (derived from existing entities).
 * Does not create duplicate candidate records — stages are computed from linked data.
 */
export const PIPELINE_STAGES = [
  "SOURCED",
  "CONSENT_PENDING",
  "CONSENT_RECEIVED",
  "EVALUATED",
  "SUBMITTED",
  "DUPLICATE_REVIEW",
  "INTERVIEW",
  "OFFER",
  "OFFER_ACCEPTED",
  "JOINED",
  "NOT_JOINED",
  "GUARANTEE",
  "REPLACEMENT",
  "CLOSED",
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  SOURCED: "Sourced",
  CONSENT_PENDING: "Consent pending",
  CONSENT_RECEIVED: "Consent received",
  EVALUATED: "Evaluated",
  SUBMITTED: "Submitted",
  DUPLICATE_REVIEW: "Duplicate review",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  OFFER_ACCEPTED: "Offer accepted",
  JOINED: "Joined",
  NOT_JOINED: "Not joined",
  GUARANTEE: "Guarantee",
  REPLACEMENT: "Replacement",
  CLOSED: "Closed",
}

/** Allowed forward transitions for explicit stage moves (pipeline API). */
export const PIPELINE_ALLOWED_TRANSITIONS: Record<PipelineStage, readonly PipelineStage[]> = {
  SOURCED: ["CONSENT_PENDING", "CONSENT_RECEIVED", "CLOSED"],
  CONSENT_PENDING: ["CONSENT_RECEIVED", "CLOSED"],
  CONSENT_RECEIVED: ["EVALUATED", "CLOSED"],
  EVALUATED: ["SUBMITTED", "CLOSED"],
  SUBMITTED: ["DUPLICATE_REVIEW", "INTERVIEW", "CLOSED"],
  DUPLICATE_REVIEW: ["SUBMITTED", "INTERVIEW", "CLOSED"],
  INTERVIEW: ["OFFER", "CLOSED"],
  OFFER: ["OFFER_ACCEPTED", "NOT_JOINED", "CLOSED"],
  OFFER_ACCEPTED: ["JOINED", "NOT_JOINED", "CLOSED"],
  JOINED: ["GUARANTEE", "REPLACEMENT", "CLOSED"],
  NOT_JOINED: ["CLOSED"],
  GUARANTEE: ["REPLACEMENT", "CLOSED"],
  REPLACEMENT: ["CLOSED"],
  CLOSED: [],
}
