import { beforeEach, describe, expect, it, vi } from "vitest"

import { IDS, mockQuery } from "../__tests__/helpers.js"

vi.mock("../models/recruitment-mandate.model.js", () => ({
  RecruitmentMandateModel: {
    findOne: vi.fn(),
  },
}))

const { RecruitmentMandateModel } = await import("../models/recruitment-mandate.model.js")
const { generateMandateNumber } = await import("./mandate-number.js")

describe("generateMandateNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("starts at RM-YYYY-0001 when no mandates exist", async () => {
    vi.mocked(RecruitmentMandateModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(generateMandateNumber(IDS.org, new Date("2026-08-30T10:00:00.000Z"))).resolves.toBe(
      "RM-2026-0001"
    )
  })

  it("increments the latest number for the same year", async () => {
    vi.mocked(RecruitmentMandateModel.findOne).mockReturnValue(
      mockQuery({ mandateNumber: "RM-2026-0007" }) as never
    )

    await expect(generateMandateNumber(IDS.org, new Date("2026-08-30T10:00:00.000Z"))).resolves.toBe(
      "RM-2026-0008"
    )
  })
})
