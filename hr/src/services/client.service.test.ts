import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth, IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"

vi.mock("../models/client.model.js", () => ({
  ClientModel: {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndDelete: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock("../models/recruitment-mandate.model.js", () => ({
  RecruitmentMandateModel: {
    exists: vi.fn(),
  },
}))

vi.mock("../models/client-agreement.model.js", () => ({
  ClientAgreementModel: {
    exists: vi.fn(),
  },
}))

vi.mock("../models/candidate-submission.model.js", () => ({
  CandidateSubmissionModel: {
    exists: vi.fn(),
  },
}))

vi.mock("../models/joining.model.js", () => ({
  JoiningModel: {
    exists: vi.fn(),
  },
}))

vi.mock("../models/invoice.model.js", () => ({
  InvoiceModel: {
    exists: vi.fn(),
  },
}))

vi.mock("../models/guarantee-follow-up.model.js", () => ({
  GuaranteeFollowUpModel: {
    exists: vi.fn(),
  },
}))

vi.mock("../models/replacement-case.model.js", () => ({
  ReplacementCaseModel: {
    exists: vi.fn(),
  },
}))

vi.mock("../utils/activity.js", () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../utils/audit.js", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}))

const { ClientModel } = await import("../models/client.model.js")
const { createClient, getClient, listClients } = await import("./client.service.js")

const hr = auth("HR_ADMIN", IDS.hrUser)

const now = new Date("2026-08-30T10:00:00.000Z")

function makeClient(overrides: Record<string, unknown> = {}) {
  return {
    _id: IDS.client,
    id: IDS.client,
    organizationId: IDS.org,
    companyName: "Acme Staffing",
    industry: "IT",
    website: "https://acme.example",
    contactPersons: [{ _id: "64a0000000000000000000c1", name: "Pat Lee", designation: "HR", email: "pat@acme.example", phone: "" }],
    address: "1 Market St",
    city: "Pune",
    state: "MH",
    country: "India",
    status: "LEAD",
    notes: "",
    createdBy: { _id: IDS.hrUser, name: "Pat Admin", email: "hr@example.com" },
    createdAt: now,
    updatedAt: now,
    toObject() {
      return this
    },
    populate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("client.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("scopes list queries to the authenticated organization", async () => {
    vi.mocked(ClientModel.find).mockReturnValue(mockQuery([makeClient()]) as never)
    vi.mocked(ClientModel.countDocuments).mockResolvedValue(1)

    const result = await listClients(hr, { search: "Acme", status: "LEAD", page: 1, limit: 20 })

    expect(ClientModel.find).toHaveBeenCalledWith({
      organizationId: IDS.org,
      status: "LEAD",
      $or: expect.any(Array),
    })
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.companyName).toBe("Acme Staffing")
    expect(result.total).toBe(1)
  })

  it("stores organizationId from auth instead of the request body", async () => {
    const created = makeClient()
    vi.mocked(ClientModel.create).mockResolvedValue(created as never)

    const client = await createClient(hr, { companyName: "Acme Staffing" })

    expect(ClientModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        createdBy: IDS.hrUser,
        companyName: "Acme Staffing",
        status: "LEAD",
        onboardingStatus: "PENDING",
        KYCStatus: "PENDING",
      })
    )
    expect(client.organizationId).toBe(IDS.org)
  })

  it("does not return a client that belongs to another organization", async () => {
    vi.mocked(ClientModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(getClient(hr, IDS.client)).rejects.toMatchObject({
      statusCode: 404,
      message: MESSAGES.CLIENT_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(ClientModel.findOne).toHaveBeenCalledWith({
      _id: IDS.client,
      organizationId: IDS.org,
    })
  })
})
