import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth, IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"

vi.mock("../models/offer.model.js", () => ({
  OfferModel: {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndDelete: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock("../models/pre-joining-follow-up.model.js", () => ({
  PreJoiningFollowUpModel: {
    exists: vi.fn(),
  },
}))

vi.mock("../models/joining.model.js", () => ({
  JoiningModel: {
    exists: vi.fn(),
  },
}))

vi.mock("../models/candidate.model.js", () => ({
  CandidateModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../models/recruitment-mandate.model.js", () => ({
  RecruitmentMandateModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../models/candidate-submission.model.js", () => ({
  CandidateSubmissionModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../utils/activity.js", () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../utils/audit.js", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}))

const { OfferModel } = await import("../models/offer.model.js")
const { CandidateModel } = await import("../models/candidate.model.js")
const { RecruitmentMandateModel } = await import("../models/recruitment-mandate.model.js")
const { CandidateSubmissionModel } = await import("../models/candidate-submission.model.js")
const { createOffer, getOffer, listOffers } = await import("./offer.service.js")

const hr = auth("HR_ADMIN", IDS.hrUser)
const now = new Date("2026-08-30T10:00:00.000Z")

function makeOffer(overrides: Record<string, unknown> = {}) {
  return {
    _id: IDS.offer,
    id: IDS.offer,
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
    submissionId: { _id: IDS.submission, status: "SUBMITTED" },
    selectedDate: now,
    offeredDesignation: "Senior Engineer",
    offeredCTC: 1800000,
    offerDate: now,
    offerStatus: "SENT",
    expectedJoiningDate: new Date("2026-09-15T00:00:00.000Z"),
    actualJoiningDate: null,
    joiningStatus: "PENDING",
    remarks: "Awaiting acceptance",
    createdAt: now,
    updatedAt: now,
    toObject() {
      return this
    },
    populate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("offer.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("scopes list queries to the authenticated organization", async () => {
    vi.mocked(OfferModel.find).mockReturnValue(mockQuery([makeOffer()]) as never)
    vi.mocked(OfferModel.countDocuments).mockResolvedValue(1)

    const result = await listOffers(hr, {
      submissionId: IDS.submission,
      page: 1,
      limit: 20,
    })

    expect(OfferModel.find).toHaveBeenCalledWith({
      organizationId: IDS.org,
      submissionId: IDS.submission,
    })
    expect(result.items[0]?.offerStatus).toBe("SENT")
  })

  it("rejects a submission from another organization", async () => {
    vi.mocked(CandidateSubmissionModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(
      createOffer(hr, {
        submissionId: IDS.submission,
        offeredDesignation: "Engineer",
        offeredCTC: 1500000,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MESSAGES.SUBMISSION_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(OfferModel.create).not.toHaveBeenCalled()
  })

  it("creates an offer with organizationId from auth and prevents an active duplicate", async () => {
    vi.mocked(CandidateSubmissionModel.findOne).mockReturnValue(
      mockQuery({
        _id: IDS.submission,
        candidateId: IDS.candidate,
        mandateId: IDS.mandate,
        status: "SUBMITTED",
      }) as never
    )
    vi.mocked(CandidateModel.findOne).mockReturnValue(
      mockQuery({ _id: IDS.candidate, name: "Ada Lovelace" }) as never
    )
    vi.mocked(RecruitmentMandateModel.findOne).mockReturnValue(
      mockQuery({ _id: IDS.mandate, mandateNumber: "RM-2026-0001" }) as never
    )
    vi.mocked(OfferModel.findOne).mockReturnValue(mockQuery(null) as never)
    const created = makeOffer()
    vi.mocked(OfferModel.create).mockResolvedValue(created as never)

    const offer = await createOffer(hr, {
      submissionId: IDS.submission,
      offeredDesignation: "Senior Engineer",
      offeredCTC: 1800000,
      offerStatus: "SENT",
    })

    expect(OfferModel.findOne).toHaveBeenCalledWith({
      organizationId: IDS.org,
      submissionId: IDS.submission,
      offerStatus: { $in: ["DRAFT", "SENT", "ACCEPTED"] },
    })
    expect(OfferModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        candidateId: IDS.candidate,
        mandateId: IDS.mandate,
        offeredDesignation: "Senior Engineer",
        offeredCTC: 1800000,
        offerStatus: "SENT",
      })
    )
    expect(offer.organizationId).toBe(IDS.org)
  })

  it("does not return an offer from another organization", async () => {
    vi.mocked(OfferModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(getOffer(hr, IDS.offer)).rejects.toMatchObject({
      statusCode: 404,
      message: MESSAGES.OFFER_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(OfferModel.findOne).toHaveBeenCalledWith({
      _id: IDS.offer,
      organizationId: IDS.org,
    })
  })
})
