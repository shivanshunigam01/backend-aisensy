import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth, IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"

vi.mock("../models/client-agreement.model.js", () => ({
  ClientAgreementModel: {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndDelete: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock("../models/client.model.js", () => ({
  ClientModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../models/recruitment-mandate.model.js", () => ({
  RecruitmentMandateModel: {
    exists: vi.fn(),
  },
}))

vi.mock("../utils/agreement-number.js", () => ({
  generateAgreementNumber: vi.fn().mockResolvedValue("CA-2026-0001"),
}))

vi.mock("../utils/activity.js", () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../utils/audit.js", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}))

const { ClientAgreementModel } = await import("../models/client-agreement.model.js")
const { ClientModel } = await import("../models/client.model.js")
const { generateAgreementNumber } = await import("../utils/agreement-number.js")
const { createAgreement, getAgreement, listAgreements } = await import("./agreement.service.js")

const hr = auth("HR_ADMIN", IDS.hrUser)
const now = new Date("2026-08-30T10:00:00.000Z")

function makeAgreement(overrides: Record<string, unknown> = {}) {
  return {
    _id: IDS.agreement,
    id: IDS.agreement,
    organizationId: IDS.org,
    clientId: {
      _id: IDS.client,
      companyName: "Acme Staffing",
      status: "ACTIVE",
      industry: "IT",
    },
    agreementNumber: "CA-2026-0001",
    effectiveDate: new Date("2026-08-01T00:00:00.000Z"),
    expiryDate: new Date("2027-07-31T00:00:00.000Z"),
    signedDate: new Date("2026-08-05T00:00:00.000Z"),
    commercialTerms: {
      recruitmentFee: 8.33,
      feeType: "PERCENTAGE",
      paymentTermsDays: 30,
    },
    ownershipPeriodMonths: 6,
    duplicateNotificationDays: 30,
    replacementPeriodDays: 90,
    status: "ACTIVE",
    signedDocument: { fileUrl: "https://files.example/agreement.pdf", fileName: "agreement.pdf" },
    createdBy: { _id: IDS.hrUser, name: "Pat Admin", email: "hr@example.com" },
    createdAt: now,
    updatedAt: now,
    toObject() {
      return this
    },
    populate: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    set: vi.fn(),
    ...overrides,
  }
}

describe("agreement.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(generateAgreementNumber).mockResolvedValue("CA-2026-0001")
  })

  it("scopes list queries to the authenticated organization", async () => {
    vi.mocked(ClientAgreementModel.find).mockReturnValue(mockQuery([makeAgreement()]) as never)
    vi.mocked(ClientAgreementModel.countDocuments).mockResolvedValue(1)

    const result = await listAgreements(hr, {
      search: "CA-2026",
      status: "ACTIVE",
      clientId: IDS.client,
      page: 1,
      limit: 20,
    })

    expect(ClientAgreementModel.find).toHaveBeenCalledWith({
      organizationId: IDS.org,
      status: "ACTIVE",
      clientId: IDS.client,
      $or: [{ agreementNumber: expect.any(RegExp) }],
    })
    expect(result.items[0]?.agreementNumber).toBe("CA-2026-0001")
    expect(result.total).toBe(1)
  })

  it("rejects a client from another organization", async () => {
    vi.mocked(ClientModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(
      createAgreement(hr, { clientId: IDS.client, effectiveDate: "2026-08-01" })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MESSAGES.CLIENT_NOT_IN_ORGANIZATION,
    } satisfies Partial<AppError>)

    expect(ClientModel.findOne).toHaveBeenCalledWith({
      _id: IDS.client,
      organizationId: IDS.org,
    })
    expect(ClientAgreementModel.create).not.toHaveBeenCalled()
  })

  it("creates an agreement with a generated number and auth organizationId", async () => {
    vi.mocked(ClientModel.findOne).mockReturnValue(
      mockQuery({ _id: IDS.client, companyName: "Acme Staffing" }) as never
    )
    const created = makeAgreement()
    vi.mocked(ClientAgreementModel.create).mockResolvedValue(created as never)

    const agreement = await createAgreement(hr, {
      clientId: IDS.client,
      effectiveDate: "2026-08-01",
      expiryDate: "2027-07-31",
      commercialTerms: { recruitmentFee: 8.33, feeType: "PERCENTAGE", paymentTermsDays: 30 },
      status: "ACTIVE",
    })

    expect(generateAgreementNumber).toHaveBeenCalledWith(IDS.org)
    expect(ClientAgreementModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        agreementNumber: "CA-2026-0001",
        createdBy: IDS.hrUser,
        status: "ACTIVE",
      })
    )
    expect(agreement.agreementNumber).toBe("CA-2026-0001")
    expect(agreement.organizationId).toBe(IDS.org)
  })

  it("does not return an agreement that belongs to another organization", async () => {
    vi.mocked(ClientAgreementModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(getAgreement(hr, IDS.agreement)).rejects.toMatchObject({
      statusCode: 404,
      message: MESSAGES.AGREEMENT_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(ClientAgreementModel.findOne).toHaveBeenCalledWith({
      _id: IDS.agreement,
      organizationId: IDS.org,
    })
  })
})
