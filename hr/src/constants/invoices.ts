/**
 * Invoice statuses.
 * ISSUED is the starter-kit name for a sent invoice; SENT is retained for backward compatibility.
 * OVERDUE is computed/set when due date has passed and balance remains.
 */
export const INVOICE_STATUSES = [
  "DRAFT",
  "SENT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ISSUED: "Issued",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
}

export const INVOICE_OPEN_STATUSES = [
  "DRAFT",
  "SENT",
  "ISSUED",
  "PARTIALLY_PAID",
  "OVERDUE",
] as const satisfies readonly InvoiceStatus[]

export function isOpenInvoiceStatus(status: string) {
  return (INVOICE_OPEN_STATUSES as readonly string[]).includes(status)
}

export const GST_SPLIT_MODES = ["CGST_SGST", "IGST", "NONE"] as const
export type GstSplitMode = (typeof GST_SPLIT_MODES)[number]
