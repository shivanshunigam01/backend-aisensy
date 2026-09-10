import { describe, expect, it } from "vitest"

import { addWorkingDays, isPastWorkingDayDeadline } from "./working-days.js"

describe("working-days", () => {
  it("adds working days skipping weekends", () => {
    // Friday + 1 working day => Monday
    const friday = new Date("2026-01-02T00:00:00.000Z") // Friday
    const next = addWorkingDays(friday, 1)
    expect(next.toISOString().slice(0, 10)).toBe("2026-01-05")

    // Friday + 3 working days => Wednesday
    const three = addWorkingDays(friday, 3)
    expect(three.toISOString().slice(0, 10)).toBe("2026-01-07")
  })

  it("detects past working-day deadlines", () => {
    const deadline = new Date("2026-01-05T00:00:00.000Z")
    expect(isPastWorkingDayDeadline(deadline, new Date("2026-01-05T12:00:00.000Z"))).toBe(false)
    expect(isPastWorkingDayDeadline(deadline, new Date("2026-01-06T00:00:00.000Z"))).toBe(true)
  })
})
