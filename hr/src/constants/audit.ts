export const AUDIT_MODULES = [
  "CLIENTS",
  "AGREEMENTS",
  "MANDATES",
  "CANDIDATES",
  "CONSENTS",
  "EVALUATIONS",
  "SUBMISSIONS",
  "INTERVIEWS",
  "OFFERS",
  "JOININGS",
  "INVOICES",
  "PAYMENTS",
  "GUARANTEES",
  "REPLACEMENTS",
] as const

export type AuditModule = (typeof AUDIT_MODULES)[number]

export const AUDIT_MODULE_LABELS: Record<AuditModule, string> = {
  CLIENTS: "Clients",
  AGREEMENTS: "Agreements",
  MANDATES: "Mandates",
  CANDIDATES: "Candidates",
  CONSENTS: "Consents",
  EVALUATIONS: "Evaluations",
  SUBMISSIONS: "Submissions",
  INTERVIEWS: "Interviews",
  OFFERS: "Offers",
  JOININGS: "Joinings",
  INVOICES: "Invoices",
  PAYMENTS: "Payments",
  GUARANTEES: "Guarantees",
  REPLACEMENTS: "Replacements",
}

export const AUDIT_ACTIONS = [
  "CREATED",
  "UPDATED",
  "STATUS_CHANGED",
  "SUBMITTED",
  "ACCEPTED",
  "JOINED",
  "APPROVED",
  "REJECTED",
  "OVERRIDE",
  "GENERATED",
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  CREATED: "Created",
  UPDATED: "Updated",
  STATUS_CHANGED: "Status changed",
  SUBMITTED: "Submitted",
  ACCEPTED: "Accepted",
  JOINED: "Joined",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  OVERRIDE: "Override",
  GENERATED: "Generated",
}
