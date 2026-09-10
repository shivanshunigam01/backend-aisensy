import { beforeEach, describe, expect, it, vi } from "vitest"

import { IDS, mockQuery } from "../__tests__/helpers.js"

vi.mock("../models/client-agreement.model.js", () => ({
  ClientAgreementModel: {
    findOne: vi.fn(),
  },
}))

const { ClientAgreementModel } = await import("../models/client-agreement.model.js")
const { generateAgreementNumber } = await import("./agreement-number.js")

describe("generateAgreementNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("starts at CA-YYYY-0001 when no agreements exist", async () => {
    vi.mocked(ClientAgreementModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(
      generateAgreementNumber(IDS.org, new Date("2026-08-30T10:00:00.000Z"))
    ).resolves.toBe("CA-2026-0001")
  })

  it("increments the latest number for the same year", async () => {
    vi.mocked(ClientAgreementModel.findOne).mockReturnValue(
      mockQuery({ agreementNumber: "CA-2026-0004" }) as never
    )

    await expect(
      generateAgreementNumber(IDS.org, new Date("2026-08-30T10:00:00.000Z"))
    ).resolves.toBe("CA-2026-0005")
  })
})
