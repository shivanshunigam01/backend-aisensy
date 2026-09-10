import { ClientAgreementModel } from "../models/client-agreement.model.js"
import { dateKeyInTimeZone } from "./dates.js"

const DEFAULT_TIMEZONE = "Asia/Kolkata"

export function agreementYear(date = new Date()) {
  return dateKeyInTimeZone(date, DEFAULT_TIMEZONE).slice(0, 4)
}

export async function generateAgreementNumber(organizationId: string, date = new Date()) {
  const year = agreementYear(date)
  const last = await ClientAgreementModel.findOne({
    organizationId,
    agreementNumber: new RegExp(`^CA-${year}-\\d+$`),
  })
    .sort({ agreementNumber: -1 })
    .select("agreementNumber")
    .lean()

  const current = last?.agreementNumber?.match(/-(\d+)$/)?.[1]
  const next = current ? Number(current) + 1 : 1

  return `CA-${year}-${String(next).padStart(4, "0")}`
}
