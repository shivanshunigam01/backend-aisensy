import { RecruitmentMandateModel } from "../models/recruitment-mandate.model.js"
import { dateKeyInTimeZone } from "./dates.js"

const DEFAULT_TIMEZONE = "Asia/Kolkata"

export function mandateYear(date = new Date()) {
  return dateKeyInTimeZone(date, DEFAULT_TIMEZONE).slice(0, 4)
}

export async function generateMandateNumber(organizationId: string, date = new Date()) {
  const year = mandateYear(date)
  const last = await RecruitmentMandateModel.findOne({
    organizationId,
    mandateNumber: new RegExp(`^RM-${year}-\\d+$`),
  })
    .sort({ mandateNumber: -1 })
    .select("mandateNumber")
    .lean()

  const current = last?.mandateNumber?.match(/-(\d+)$/)?.[1]
  const next = current ? Number(current) + 1 : 1

  return `RM-${year}-${String(next).padStart(4, "0")}`
}
