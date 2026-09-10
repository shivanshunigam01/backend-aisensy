import { describe, expect, it } from "vitest"

import { evaluateReplacementEligibility } from "./replacement-eligibility.js"

describe("evaluateReplacementEligibility", () => {
  const joiningDate = new Date("2026-01-01T00:00:00.000Z")
  const withinPeriod = new Date("2026-02-15T00:00:00.000Z")
  const outsidePeriod = new Date("2026-06-01T00:00:00.000Z")

  it("approves an eligible free replacement", () => {
    const result = evaluateReplacementEligibility({
      joiningDate,
      requestedDate: withinPeriod,
      replacementPeriodDays: 90,
      reason: "RESIGNED",
      invoicePaidOnTime: true,
      freeReplacementsUsed: 0,
    })
    expect(result.result).toBe("APPROVED")
    expect(result.freeReplacementAvailable).toBe(true)
    expect(result.withinGuaranteePeriod).toBe(true)
  })

  it("marks exclusion reasons as not eligible", () => {
    const result = evaluateReplacementEligibility({
      joiningDate,
      requestedDate: withinPeriod,
      replacementPeriodDays: 90,
      reason: "SALARY_DELAY",
      invoicePaidOnTime: true,
    })
    expect(result.result).toBe("NOT_ELIGIBLE")
  })

  it("requires review when invoice payment is unknown", () => {
    const result = evaluateReplacementEligibility({
      joiningDate,
      requestedDate: withinPeriod,
      replacementPeriodDays: 90,
      reason: "PERFORMANCE",
      invoicePaidOnTime: null,
    })
    expect(result.result).toBe("REVIEW")
  })

  it("rejects outside guarantee period", () => {
    const result = evaluateReplacementEligibility({
      joiningDate,
      requestedDate: outsidePeriod,
      replacementPeriodDays: 90,
      reason: "RESIGNED",
      invoicePaidOnTime: true,
    })
    expect(result.result).toBe("NOT_ELIGIBLE")
  })
})
