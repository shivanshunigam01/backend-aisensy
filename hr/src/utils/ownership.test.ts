import { describe, expect, it } from "vitest"

import { calculateOwnershipWindow, resolveOwnershipStatus } from "./ownership.js"

describe("ownership", () => {
  it("calculates a 12-month ownership window", () => {
    const window = calculateOwnershipWindow(new Date("2026-01-15T00:00:00.000Z"), 12)
    expect(window.ownershipStartDate.toISOString().slice(0, 10)).toBe("2026-01-15")
    expect(window.ownershipEndDate.toISOString().slice(0, 10)).toBe("2027-01-15")
    expect(window.ownershipPeriodMonths).toBe(12)
  })

  it("resolves ACTIVE within the window and EXPIRED after", () => {
    const start = new Date("2026-01-01T00:00:00.000Z")
    const end = new Date("2026-12-31T00:00:00.000Z")
    expect(
      resolveOwnershipStatus({
        ownershipStartDate: start,
        ownershipEndDate: end,
        now: new Date("2026-06-01T00:00:00.000Z"),
      })
    ).toBe("ACTIVE")
    expect(
      resolveOwnershipStatus({
        ownershipStartDate: start,
        ownershipEndDate: end,
        now: new Date("2027-01-02T00:00:00.000Z"),
      })
    ).toBe("EXPIRED")
    expect(
      resolveOwnershipStatus({
        ownershipStartDate: start,
        ownershipEndDate: end,
        disputed: true,
      })
    ).toBe("DISPUTED")
  })
})
