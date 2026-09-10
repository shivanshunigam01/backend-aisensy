import { CandidateModel } from "../models/candidate.model.js"
import { dateKeyInTimeZone } from "./dates.js"

const DEFAULT_TIMEZONE = "Asia/Kolkata"

export async function generateCandidateNumber(organizationId: string, date = new Date()) {
  const year = dateKeyInTimeZone(date, DEFAULT_TIMEZONE).slice(0, 4)
  const last = await CandidateModel.findOne({
    organizationId,
    candidateNumber: new RegExp(`^CAND-${year}-\\d+$`),
  })
    .sort({ candidateNumber: -1 })
    .select("candidateNumber")
    .lean()

  const current = last?.candidateNumber?.match(/-(\d+)$/)?.[1]
  const next = current ? Number(current) + 1 : 1

  return `CAND-${year}-${String(next).padStart(4, "0")}`
}

export function splitCandidateName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] ?? name,
    lastName: parts.slice(1).join(" "),
  }
}
