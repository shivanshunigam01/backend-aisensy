import { describe, expect, it } from "vitest"

import { createAgreementSchema } from "./agreement.validators.js"

const validBody = {
  clientId: "507f1f77bcf86cd799439011",
  effectiveDate: "2019-05-05",
  expiryDate: "2024-07-15",
  signedDate: "2019-05-05",
  commercialTerms: {
    recruitmentFee: 40,
    feeType: "PERCENTAGE",
    paymentTermsDays: 12,
  },
  ownershipPeriodMonths: 1,
  duplicateNotificationDays: 26,
  replacementPeriodDays: 15,
  status: "EXPIRED",
}

describe("createAgreementSchema", () => {
  it("rejects a signed date before the effective date", () => {
    const parsed = createAgreementSchema.safeParse({
      ...validBody,
      signedDate: "1974-07-28",
    })

    expect(parsed.success).toBe(false)
    if (parsed.success) return
    expect(parsed.error.flatten().fieldErrors.signedDate).toContain(
      "Signed date cannot be before the effective date"
    )
  })

  it("rejects an incomplete signed document URL", () => {
    const parsed = createAgreementSchema.safeParse({
      ...validBody,
      signedDocument: "https://",
    })

    expect(parsed.success).toBe(false)
    if (parsed.success) return
    expect(parsed.error.flatten().formErrors.concat(
      Object.values(parsed.error.flatten().fieldErrors).flat()
    )).toEqual(
      expect.arrayContaining(["Enter a signed document URL starting with http:// or https://"])
    )
  })
})
