import { JobApplicationModel } from "../models/job-application.model.js"
import { dateKeyInTimeZone } from "./dates.js"

const DEFAULT_TIMEZONE = "Asia/Kolkata"

export async function generateApplicationNumber(organizationId: string, date = new Date()) {
  const year = dateKeyInTimeZone(date, DEFAULT_TIMEZONE).slice(0, 4)
  const last = await JobApplicationModel.findOne({
    organizationId,
    applicationNumber: new RegExp(`^APP-${year}-\\d+$`),
  })
    .sort({ applicationNumber: -1 })
    .select("applicationNumber")
    .lean()

  const current = last?.applicationNumber?.match(/-(\d+)$/)?.[1]
  const next = current ? Number(current) + 1 : 1

  return `APP-${year}-${String(next).padStart(4, "0")}`
}
