import { InvoiceModel } from "../models/invoice.model.js"
import { dateKeyInTimeZone } from "./dates.js"

const DEFAULT_TIMEZONE = "Asia/Kolkata"

export function invoiceYear(date = new Date()) {
  return dateKeyInTimeZone(date, DEFAULT_TIMEZONE).slice(0, 4)
}

export async function generateInvoiceNumber(organizationId: string, date = new Date()) {
  const year = invoiceYear(date)
  const last = await InvoiceModel.findOne({
    organizationId,
    invoiceNumber: new RegExp(`^INV-${year}-\\d+$`),
  })
    .sort({ invoiceNumber: -1 })
    .select("invoiceNumber")
    .lean()

  const current = last?.invoiceNumber?.match(/-(\d+)$/)?.[1]
  const next = current ? Number(current) + 1 : 1

  return `INV-${year}-${String(next).padStart(4, "0")}`
}
