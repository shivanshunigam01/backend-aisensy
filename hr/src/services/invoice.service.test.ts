import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth, IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"

vi.mock("../models/invoice.model.js", () => ({
  InvoiceModel: {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndDelete: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock("../models/invoice-payment.model.js", () => ({
  InvoicePaymentModel: {
    exists: vi.fn(),
    aggregate: vi.fn(),
  },
}))

vi.mock("../models/client.model.js", () => ({
  ClientModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../models/joining.model.js", () => ({
  JoiningModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../utils/invoice-number.js", () => ({
  generateInvoiceNumber: vi.fn().mockResolvedValue("INV-2026-0001"),
}))

vi.mock("../utils/activity.js", () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../utils/audit.js", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}))

const { InvoiceModel } = await import("../models/invoice.model.js")
const { InvoicePaymentModel } = await import("../models/invoice-payment.model.js")
const { ClientModel } = await import("../models/client.model.js")
const { generateInvoiceNumber } = await import("../utils/invoice-number.js")
const { createInvoice, getInvoice, listInvoices, recalculateInvoiceBalances } = await import(
  "./invoice.service.js"
)

const hr = auth("HR_ADMIN", IDS.hrUser)
const now = new Date("2026-08-30T10:00:00.000Z")

function makeInvoice(overrides: Record<string, unknown> = {}) {
  return {
    _id: IDS.invoice,
    id: IDS.invoice,
    organizationId: IDS.org,
    clientId: { _id: IDS.client, companyName: "Acme Corp" },
    joiningId: { _id: IDS.joining, joiningDate: now, status: "JOINED" },
    invoiceNumber: "INV-2026-0001",
    invoiceDate: now,
    amount: 100000,
    paidAmount: 0,
    outstandingAmount: 100000,
    status: "SENT",
    remarks: "",
    createdAt: now,
    updatedAt: now,
    save: vi.fn().mockResolvedValue(undefined),
    toObject() {
      return this
    },
    populate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("invoice.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("scopes list queries to the authenticated organization", async () => {
    vi.mocked(InvoiceModel.find).mockReturnValue(mockQuery([makeInvoice()]) as never)
    vi.mocked(InvoiceModel.countDocuments).mockResolvedValue(1)

    const result = await listInvoices(hr, {
      clientId: IDS.client,
      page: 1,
      limit: 20,
    })

    expect(InvoiceModel.find).toHaveBeenCalledWith({
      organizationId: IDS.org,
      clientId: IDS.client,
    })
    expect(result.items[0]?.invoiceNumber).toBe("INV-2026-0001")
  })

  it("rejects a client from another organization", async () => {
    vi.mocked(ClientModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(createInvoice(hr, { clientId: IDS.client, amount: 100000 })).rejects.toMatchObject({
      statusCode: 400,
      message: MESSAGES.CLIENT_NOT_IN_ORGANIZATION,
    } satisfies Partial<AppError>)

    expect(InvoiceModel.create).not.toHaveBeenCalled()
  })

  it("creates an invoice with organizationId from auth and zero paid amount", async () => {
    vi.mocked(ClientModel.findOne).mockReturnValue(
      mockQuery({ _id: IDS.client, companyName: "Acme Corp" }) as never
    )
    vi.mocked(generateInvoiceNumber).mockResolvedValue("INV-2026-0001")
    const created = makeInvoice()
    vi.mocked(InvoiceModel.create).mockResolvedValue(created as never)

    const invoice = await createInvoice(hr, { clientId: IDS.client, amount: 100000 })

    expect(InvoiceModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        clientId: IDS.client,
        amount: 100000,
        paidAmount: 0,
        outstandingAmount: 100000,
        status: "SENT",
      })
    )
    expect(invoice.organizationId).toBe(IDS.org)
    expect(invoice.outstandingAmount).toBe(100000)
  })

  it("does not return an invoice from another organization", async () => {
    vi.mocked(InvoiceModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(getInvoice(hr, IDS.invoice)).rejects.toMatchObject({
      statusCode: 404,
      message: MESSAGES.INVOICE_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(InvoiceModel.findOne).toHaveBeenCalledWith({
      _id: IDS.invoice,
      organizationId: IDS.org,
    })
  })

  it("recalculates paid and outstanding amounts from completed payments", async () => {
    const invoice = makeInvoice()
    vi.mocked(InvoiceModel.findOne).mockReturnValue(mockQuery(invoice) as never)
    vi.mocked(InvoicePaymentModel.aggregate).mockResolvedValue([{ total: 40000 }] as never)

    const updated = await recalculateInvoiceBalances(IDS.org, IDS.invoice)

    expect(invoice.paidAmount).toBe(40000)
    expect(invoice.outstandingAmount).toBe(60000)
    expect(invoice.status).toBe("PARTIALLY_PAID")
    expect(updated.paidAmount).toBe(40000)
  })
})
