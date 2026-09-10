import { describe, expect, it } from "vitest"

import { calculatePlacementFee } from "./placement-fee.js"

describe("calculatePlacementFee", () => {
  it("computes percentage of CTC with CGST/SGST split", () => {
    const result = calculatePlacementFee({
      feeType: "PERCENTAGE",
      recruitmentFee: 8.33,
      offeredAnnualCtc: 1_200_000,
      gstRatePercent: 18,
      gstSplitMode: "CGST_SGST",
      invoiceDate: new Date("2026-01-15T00:00:00.000Z"),
      paymentTermsDays: 15,
    })

    expect(result.professionalFee).toBe(99_960)
    expect(result.gstAmount).toBe(17_992.8)
    expect(result.cgst).toBe(8996.4)
    expect(result.sgst).toBe(8996.4)
    expect(result.igst).toBe(0)
    expect(result.totalAmount).toBe(117_952.8)
    expect(result.dueDate.toISOString().slice(0, 10)).toBe("2026-01-30")
  })

  it("uses fixed fee and IGST mode", () => {
    const result = calculatePlacementFee({
      feeType: "FIXED",
      recruitmentFee: 100_000,
      offeredAnnualCtc: 0,
      gstRatePercent: 18,
      gstSplitMode: "IGST",
      invoiceDate: new Date("2026-03-01T00:00:00.000Z"),
      paymentTermsDays: 30,
    })

    expect(result.professionalFee).toBe(100_000)
    expect(result.igst).toBe(18_000)
    expect(result.cgst).toBe(0)
    expect(result.totalAmount).toBe(118_000)
    expect(result.dueDate.toISOString().slice(0, 10)).toBe("2026-03-31")
  })
})
