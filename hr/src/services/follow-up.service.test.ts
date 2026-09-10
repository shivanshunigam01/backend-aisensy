import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth, IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"

vi.mock("../models/pre-joining-follow-up.model.js", () => ({
  PreJoiningFollowUpModel: {
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

vi.mock("../models/offer.model.js", () => ({
  OfferModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../models/user.model.js", () => ({
  UserModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../utils/activity.js", () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}))

const { PreJoiningFollowUpModel } = await import("../models/pre-joining-follow-up.model.js")
const { CandidateModel } = await import("../models/candidate.model.js")
const { OfferModel } = await import("../models/offer.model.js")
const { UserModel } = await import("../models/user.model.js")
const { createFollowUp, getFollowUp, listFollowUps } = await import("./follow-up.service.js")

const hr = auth("HR_ADMIN", IDS.hrUser)
const now = new Date("2026-08-30T10:00:00.000Z")

function makeFollowUp(overrides: Record<string, unknown> = {}) {
  return {
    _id: IDS.followUp,
    id: IDS.followUp,
    organizationId: IDS.org,
    candidateId: {
      _id: IDS.candidate,
      name: "Ada Lovelace",
      email: "ada@example.com",
      candidateNumber: "CAND-2026-0001",
    },
    offerId: {
      _id: IDS.offer,
      offeredDesignation: "Senior Engineer",
      offerStatus: "ACCEPTED",
      expectedJoiningDate: now,
      joiningStatus: "PENDING",
    },
    followUpDate: now,
    followUpType: "CALL",
    candidateStatus: "POSITIVE",
    joiningProbability: 8,
    riskLevel: "LOW",
    remarks: "Confirmed notice period",
    nextFollowUpDate: new Date("2026-09-05T00:00:00.000Z"),
    createdBy: { _id: IDS.hrUser, name: "Pat Admin", email: "hr@example.com", role: "HR_ADMIN" },
    createdAt: now,
    updatedAt: now,
    toObject() {
      return this
    },
    populate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("follow-up.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("scopes list queries to the authenticated organization", async () => {
    vi.mocked(PreJoiningFollowUpModel.find).mockReturnValue(mockQuery([makeFollowUp()]) as never)
    vi.mocked(PreJoiningFollowUpModel.countDocuments).mockResolvedValue(1)

    const result = await listFollowUps(hr, {
      offerId: IDS.offer,
      page: 1,
      limit: 20,
    })

    expect(PreJoiningFollowUpModel.find).toHaveBeenCalledWith({
      organizationId: IDS.org,
      offerId: IDS.offer,
    })
    expect(result.items[0]?.followUpType).toBe("CALL")
  })

  it("rejects an offer from another organization", async () => {
    vi.mocked(OfferModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(createFollowUp(hr, { offerId: IDS.offer })).rejects.toMatchObject({
      statusCode: 400,
      message: MESSAGES.OFFER_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(PreJoiningFollowUpModel.create).not.toHaveBeenCalled()
  })

  it("creates a follow-up with organizationId from auth and candidate from the offer", async () => {
    vi.mocked(OfferModel.findOne).mockReturnValue(
      mockQuery({
        _id: IDS.offer,
        candidateId: IDS.candidate,
        offeredDesignation: "Senior Engineer",
      }) as never
    )
    vi.mocked(CandidateModel.findOne).mockReturnValue(
      mockQuery({ _id: IDS.candidate, name: "Ada Lovelace" }) as never
    )
    vi.mocked(UserModel.findOne).mockReturnValue(mockQuery({ _id: IDS.hrUser }) as never)
    const created = makeFollowUp()
    vi.mocked(PreJoiningFollowUpModel.create).mockResolvedValue(created as never)

    const followUp = await createFollowUp(hr, {
      offerId: IDS.offer,
      followUpType: "CALL",
      joiningProbability: 8,
    })

    expect(PreJoiningFollowUpModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        candidateId: IDS.candidate,
        offerId: IDS.offer,
        createdBy: IDS.hrUser,
        followUpType: "CALL",
        joiningProbability: 8,
      })
    )
    expect(followUp.organizationId).toBe(IDS.org)
  })

  it("does not return a follow-up from another organization", async () => {
    vi.mocked(PreJoiningFollowUpModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(getFollowUp(hr, IDS.followUp)).rejects.toMatchObject({
      statusCode: 404,
      message: MESSAGES.FOLLOW_UP_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(PreJoiningFollowUpModel.findOne).toHaveBeenCalledWith({
      _id: IDS.followUp,
      organizationId: IDS.org,
    })
  })
})
