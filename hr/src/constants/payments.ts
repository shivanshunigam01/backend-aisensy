export const PAYMENT_METHODS = [
  "BANK_TRANSFER",
  "UPI",
  "NEFT",
  "RTGS",
  "CHEQUE",
  "CASH",
  "CARD",
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Bank transfer",
  UPI: "UPI",
  NEFT: "NEFT",
  RTGS: "RTGS",
  CHEQUE: "Cheque",
  CASH: "Cash",
  CARD: "Card",
}

export const PAYMENT_STATUSES = ["PENDING", "COMPLETED", "FAILED", "REVERSED"] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  COMPLETED: "Completed",
  FAILED: "Failed",
  REVERSED: "Reversed",
}

export function isCompletedPaymentStatus(status: string) {
  return status === "COMPLETED"
}
