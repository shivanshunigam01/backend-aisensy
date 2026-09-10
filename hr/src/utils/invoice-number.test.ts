import { beforeEach, describe, expect, it, vi } from "vitest"

import { IDS, mockQuery } from "../__tests__/helpers.js"

vi.mock("../models/invoice.model.js", () => ({
  InvoiceModel: {
    findOne: vi.fn(),
  },
}))

const { InvoiceModel } = await import("../models/invoice.model.js")
const { generateInvoiceNumber } = await import("./invoice-number.js")

describe("generateInvoiceNumber", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("starts at INV-YYYY-0001 when no invoices exist", async () => {
    vi.mocked(InvoiceModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(
      generateInvoiceNumber(IDS.org, new Date("2026-08-30T10:00:00.000Z"))
    ).resolves.toBe("INV-2026-0001")
  })

  it("increments the latest number for the same year", async () => {
    vi.mocked(InvoiceModel.findOne).mockReturnValue(
      mockQuery({ invoiceNumber: "INV-2026-0004" }) as never
    )

    await expect(
      generateInvoiceNumber(IDS.org, new Date("2026-08-30T10:00:00.000Z"))
    ).resolves.toBe("INV-2026-0005")
  })
})
