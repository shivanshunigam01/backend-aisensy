import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth, IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"

vi.mock("../models/joining.model.js", () => ({
  JoiningModel: {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndDelete: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock("../models/candidate.model.js", () => ({
  CandidateModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../models/client.model.js", () => ({
  ClientModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../models/offer.model.js", () => ({
  OfferModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../models/recruitment-mandate.model.js", () => ({
  RecruitmentMandateModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../models/user.model.js", () => ({
  UserModel: {
    findOne: vi.fn(),
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

const { JoiningModel } = await import("../models/joining.model.js")
const { CandidateModel } = await import("../models/candidate.model.js")
const { ClientModel } = await import("../models/client.model.js")
const { OfferModel } = await import("../models/offer.model.js")
const { RecruitmentMandateModel } = await import("../models/recruitment-mandate.model.js")
const { createJoining, getJoining, listJoinings } = await import("./joining.service.js")

const hr = auth("HR_ADMIN", IDS.hrUser)
const now = new Date("2026-08-30T10:00:00.000Z")

function makeJoining(overrides: Record<string, unknown> = {}) {
  return {
    _id: IDS.joining,
    id: IDS.joining,
    organizationId: IDS.org,
    candidateId: {
      _id: IDS.candidate,
      name: "Ada Lovelace",
      email: "ada@example.com",
      candidateNumber: "CAND-2026-0001",
    },
    mandateId: {
      _id: IDS.mandate,
      mandateNumber: "RM-2026-0001",
      position: "Engineer",
      status: "OPEN",
    },
    offerId: {
      _id: IDS.offer,
      offeredDesignation: "Senior Engineer",
      offerStatus: "ACCEPTED",
      expectedJoiningDate: now,
      joiningStatus: "PENDING",
    },
    clientId: {
      _id: IDS.client,
      companyName: "Acme Corp",
    },
    joiningDate: now,
    status: "EXPECTED",
    confirmedBy: null,
    confirmationDate: null,
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

describe("joining.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("scopes list queries to the authenticated organization", async () => {
    vi.mocked(JoiningModel.find).mockReturnValue(mockQuery([makeJoining()]) as never)
    vi.mocked(JoiningModel.countDocuments).mockResolvedValue(1)

    const result = await listJoinings(hr, {
      offerId: IDS.offer,
      page: 1,
      limit: 20,
    })

    expect(JoiningModel.find).toHaveBeenCalledWith({
      organizationId: IDS.org,
      offerId: IDS.offer,
    })
    expect(result.items[0]?.status).toBe("EXPECTED")
  })

  it("rejects an offer from another organization", async () => {
    vi.mocked(OfferModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(createJoining(hr, { offerId: IDS.offer })).rejects.toMatchObject({
      statusCode: 400,
      message: MESSAGES.OFFER_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(JoiningModel.create).not.toHaveBeenCalled()
  })

  it("creates a joining with organizationId from auth and related ids from the offer", async () => {
    vi.mocked(OfferModel.findOne).mockReturnValue(
      mockQuery({
        _id: IDS.offer,
        candidateId: IDS.candidate,
        mandateId: IDS.mandate,
        offeredDesignation: "Senior Engineer",
        expectedJoiningDate: now,
      }) as never
    )
    vi.mocked(CandidateModel.findOne).mockReturnValue(
      mockQuery({ _id: IDS.candidate, name: "Ada Lovelace" }) as never
    )
    vi.mocked(RecruitmentMandateModel.findOne).mockReturnValue(
      mockQuery({
        _id: IDS.mandate,
        clientId: IDS.client,
        mandateNumber: "RM-2026-0001",
      }) as never
    )
    vi.mocked(ClientModel.findOne).mockReturnValue(
      mockQuery({ _id: IDS.client, companyName: "Acme Corp" }) as never
    )
    vi.mocked(JoiningModel.findOne).mockReturnValue(mockQuery(null) as never)
    const created = makeJoining()
    vi.mocked(JoiningModel.create).mockResolvedValue(created as never)

    const joining = await createJoining(hr, { offerId: IDS.offer, status: "EXPECTED" })

    expect(JoiningModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        candidateId: IDS.candidate,
        mandateId: IDS.mandate,
        offerId: IDS.offer,
        clientId: IDS.client,
        status: "EXPECTED",
      })
    )
    expect(joining.organizationId).toBe(IDS.org)
  })

  it("does not return a joining from another organization", async () => {
    vi.mocked(JoiningModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(getJoining(hr, IDS.joining)).rejects.toMatchObject({
      statusCode: 404,
      message: MESSAGES.JOINING_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(JoiningModel.findOne).toHaveBeenCalledWith({
      _id: IDS.joining,
      organizationId: IDS.org,
    })
  })
})
