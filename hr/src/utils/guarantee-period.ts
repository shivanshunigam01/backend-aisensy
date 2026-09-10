import { addUtcDays, dateKeyFromDate } from "./dates.js"

export type GuaranteeMilestonePlan = {
  milestone30Enabled: boolean
  milestone60Enabled: boolean
  milestone90Enabled: boolean
  guaranteeStartDate: Date
  guaranteeEndDate: Date
  replacementPeriodDays: number
}

/**
 * Guarantee window = joining date + replacementPeriodDays from mandate/agreement.
 * Only enable milestones whose day falls within the guarantee period.
 */
export function planGuaranteeMilestones(
  joiningDate: Date,
  replacementPeriodDays: number
): GuaranteeMilestonePlan {
  const days = Math.max(0, Math.floor(Number(replacementPeriodDays) || 0))
  const guaranteeStartDate = new Date(joiningDate)
  const guaranteeEndDate = addUtcDays(guaranteeStartDate, days)

  return {
    milestone30Enabled: days >= 30,
    milestone60Enabled: days >= 60,
    milestone90Enabled: days >= 90,
    guaranteeStartDate,
    guaranteeEndDate,
    replacementPeriodDays: days,
  }
}

export function daysRemainingInGuarantee(guaranteeEndDate: Date, now = new Date()) {
  const end = dateKeyFromDate(guaranteeEndDate)
  const today = dateKeyFromDate(now)
  const ms = new Date(`${end}T00:00:00.000Z`).getTime() - new Date(`${today}T00:00:00.000Z`).getTime()
  return Math.ceil(ms / 86_400_000)
}
