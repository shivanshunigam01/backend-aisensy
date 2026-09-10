import { beforeEach, describe, expect, it, vi } from "vitest"

import { IDS, mockQuery } from "../__tests__/helpers.js"

vi.mock("../models/candidate.model.js", () => ({
  CandidateModel: {
    findOne: vi.fn(),
  },
}))

const { CandidateModel } = await import("../models/candidate.model.js")
const { generateCandidateNumber } = await import("./candidate-number.js")

describe("generateCandidateNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("starts at CAND-YYYY-0001 when no candidates exist", async () => {
    vi.mocked(CandidateModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(
      generateCandidateNumber(IDS.org, new Date("2026-08-30T10:00:00.000Z"))
    ).resolves.toBe("CAND-2026-0001")
  })

  it("increments the latest number for the same year", async () => {
    vi.mocked(CandidateModel.findOne).mockReturnValue(
      mockQuery({ candidateNumber: "CAND-2026-0012" }) as never
    )

    await expect(
      generateCandidateNumber(IDS.org, new Date("2026-08-30T10:00:00.000Z"))
    ).resolves.toBe("CAND-2026-0013")
  })
})
