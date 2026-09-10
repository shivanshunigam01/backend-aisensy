import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth, IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"

vi.mock("../models/invoice-payment.model.js", () => ({
  InvoicePaymentModel: {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndDelete: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
    aggregate: vi.fn(),
  },
}))

vi.mock("../models/invoice.model.js", () => ({
  InvoiceModel: {
    findOne: vi.fn(),
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

const { InvoicePaymentModel } = await import("../models/invoice-payment.model.js")
const { InvoiceModel } = await import("../models/invoice.model.js")
const { createPayment, getPayment, listPayments } = await import("./payment.service.js")

const hr = auth("HR_ADMIN", IDS.hrUser)
const now = new Date("2026-08-30T10:00:00.000Z")

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    _id: IDS.payment,
    id: IDS.payment,
    organizationId: IDS.org,
    invoiceId: {
      _id: IDS.invoice,
      invoiceNumber: "INV-2026-0001",
      amount: 100000,
      paidAmount: 40000,
      outstandingAmount: 60000,
      status: "PARTIALLY_PAID",
    },
    amount: 40000,
    paymentDate: now,
    paymentMethod: "BANK_TRANSFER",
    transactionReference: "TXN-1",
    status: "COMPLETED",
    remarks: "",
    createdAt: now,
    updatedAt: now,
    toObject() {
      return this
    },
    populate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("payment.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("scopes list queries to the authenticated organization", async () => {
    vi.mocked(InvoicePaymentModel.find).mockReturnValue(mockQuery([makePayment()]) as never)
    vi.mocked(InvoicePaymentModel.countDocuments).mockResolvedValue(1)

    const result = await listPayments(hr, {
      invoiceId: IDS.invoice,
      page: 1,
      limit: 20,
    })

    expect(InvoicePaymentModel.find).toHaveBeenCalledWith({
      organizationId: IDS.org,
      invoiceId: IDS.invoice,
    })
    expect(result.items[0]?.status).toBe("COMPLETED")
  })

  it("rejects an invoice from another organization", async () => {
    vi.mocked(InvoiceModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(createPayment(hr, { invoiceId: IDS.invoice, amount: 40000 })).rejects.toMatchObject({
      statusCode: 400,
      message: MESSAGES.INVOICE_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(InvoicePaymentModel.create).not.toHaveBeenCalled()
  })

  it("creates a payment with organizationId from auth and recalculates the invoice", async () => {
    const invoiceDoc = {
      _id: IDS.invoice,
      organizationId: IDS.org,
      invoiceNumber: "INV-2026-0001",
      amount: 100000,
      paidAmount: 0,
      outstandingAmount: 100000,
      status: "SENT",
      save: vi.fn().mockResolvedValue(undefined),
      populate: vi.fn().mockResolvedValue(undefined),
    }
    vi.mocked(InvoiceModel.findOne).mockReturnValue(mockQuery(invoiceDoc) as never)
    vi.mocked(InvoicePaymentModel.aggregate).mockResolvedValue([{ total: 40000 }] as never)
    const created = makePayment()
    vi.mocked(InvoicePaymentModel.create).mockResolvedValue(created as never)

    const payment = await createPayment(hr, {
      invoiceId: IDS.invoice,
      amount: 40000,
      paymentMethod: "UPI",
    })

    expect(InvoicePaymentModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        invoiceId: IDS.invoice,
        amount: 40000,
        paymentMethod: "UPI",
        status: "COMPLETED",
      })
    )
    expect(invoiceDoc.paidAmount).toBe(40000)
    expect(invoiceDoc.outstandingAmount).toBe(60000)
    expect(invoiceDoc.status).toBe("PARTIALLY_PAID")
    expect(payment.organizationId).toBe(IDS.org)
  })

  it("does not return a payment from another organization", async () => {
    vi.mocked(InvoicePaymentModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(getPayment(hr, IDS.payment)).rejects.toMatchObject({
      statusCode: 404,
      message: MESSAGES.PAYMENT_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(InvoicePaymentModel.findOne).toHaveBeenCalledWith({
      _id: IDS.payment,
      organizationId: IDS.org,
    })
  })
})
