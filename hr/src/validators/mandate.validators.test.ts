import { describe, expect, it } from "vitest"

import { createMandateSchema } from "./mandate.validators.js"

const validBody = {
  clientId: "507f1f77bcf86cd799439011",
  agreementId: "507f1f77bcf86cd799439012",
  position: "Senior Engineer",
}

describe("createMandateSchema", () => {
  it("returns a field-specific message when a skill entry is too long", () => {
    const parsed = createMandateSchema.safeParse({
      ...validBody,
      skills: ["x".repeat(41)],
    })

    expect(parsed.success).toBe(false)
    if (parsed.success) return

    expect(parsed.error.flatten().fieldErrors.skills).toContain(
      "Skills: each entry must be 40 characters or fewer"
    )
  })

  it("returns a field-specific message when too many qualifications are provided", () => {
    const parsed = createMandateSchema.safeParse({
      ...validBody,
      qualifications: Array.from({ length: 21 }, (_, index) => `Qualification ${index + 1}`),
    })

    expect(parsed.success).toBe(false)
    if (parsed.success) return

    expect(parsed.error.flatten().fieldErrors.qualifications).toContain(
      "Qualifications: add at most 20 entries"
    )
  })

  it("returns a field-specific message when too many recruiters are assigned", () => {
    const parsed = createMandateSchema.safeParse({
      ...validBody,
      assignedRecruiters: Array.from({ length: 21 }, () => "507f1f77bcf86cd799439011"),
    })

    expect(parsed.success).toBe(false)
    if (parsed.success) return

    expect(parsed.error.flatten().fieldErrors.assignedRecruiters).toContain(
      "Assigned recruiters: select at most 20 people"
    )
  })
})
