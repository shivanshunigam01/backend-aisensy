import {
  DEFAULT_GST_RATE_PERCENT,
  DEFAULT_PAYMENT_TERMS_DAYS,
  type AgreementFeeType,
} from "../constants/agreements.js"
import { addUtcDays } from "./dates.js"

export type GstSplitMode = "CGST_SGST" | "IGST" | "NONE"

export type PlacementFeeInput = {
  feeType: AgreementFeeType | string
  recruitmentFee: number
  offeredAnnualCtc: number
  gstRatePercent?: number
  /** When true (or mode IGST), full GST is IGST; otherwise split equally CGST/SGST. */
  gstSplitMode?: GstSplitMode
  invoiceDate?: Date
  paymentTermsDays?: number
}

export type PlacementFeeResult = {
  professionalFee: number
  gstRatePercent: number
  cgst: number
  sgst: number
  igst: number
  gstAmount: number
  totalAmount: number
  dueDate: Date
  paymentTermsDays: number
}

export function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100
}

/**
 * Calculate professional fee + GST for a placement invoice.
 *
 * FIXED: professionalFee = recruitmentFee
 * PERCENTAGE (Percentage of CTC): professionalFee = offeredAnnualCtc × recruitmentFee / 100
 */
export function calculatePlacementFee(input: PlacementFeeInput): PlacementFeeResult {
  const feeType = String(input.feeType || "PERCENTAGE").toUpperCase()
  const recruitmentFee = Math.max(0, Number(input.recruitmentFee) || 0)
  const offeredAnnualCtc = Math.max(0, Number(input.offeredAnnualCtc) || 0)
  const gstRatePercent =
    input.gstRatePercent === undefined || input.gstRatePercent === null
      ? DEFAULT_GST_RATE_PERCENT
      : Math.max(0, Number(input.gstRatePercent) || 0)
  const paymentTermsDays =
    input.paymentTermsDays === undefined || input.paymentTermsDays === null
      ? DEFAULT_PAYMENT_TERMS_DAYS
      : Math.max(0, Math.floor(Number(input.paymentTermsDays) || 0))

  let professionalFee = 0
  if (feeType === "FIXED") {
    professionalFee = recruitmentFee
  } else {
    professionalFee = roundMoney((offeredAnnualCtc * recruitmentFee) / 100)
  }
  professionalFee = roundMoney(professionalFee)

  const gstAmount = roundMoney((professionalFee * gstRatePercent) / 100)
  const mode = input.gstSplitMode ?? "CGST_SGST"

  let cgst = 0
  let sgst = 0
  let igst = 0
  if (gstAmount > 0) {
    if (mode === "IGST") {
      igst = gstAmount
    } else if (mode === "NONE") {
      // gstAmount still added to total; components left at 0 for manual invoices
    } else {
      cgst = roundMoney(gstAmount / 2)
      sgst = roundMoney(gstAmount - cgst)
    }
  }

  const invoiceDate = input.invoiceDate ?? new Date()
  const dueDate = addUtcDays(invoiceDate, paymentTermsDays)

  return {
    professionalFee,
    gstRatePercent,
    cgst,
    sgst,
    igst,
    gstAmount,
    totalAmount: roundMoney(professionalFee + gstAmount),
    dueDate,
    paymentTermsDays,
  }
}
