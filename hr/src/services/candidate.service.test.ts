import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth, IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"

vi.mock("../models/candidate.model.js", () => ({
  CandidateModel: {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndDelete: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock("../models/application.model.js", () => ({
  ApplicationModel: {
    exists: vi.fn(),
  },
}))

vi.mock("../models/candidate-consent.model.js", () => ({
  CandidateConsentModel: {
    exists: vi.fn(),
  },
}))

vi.mock("../models/candidate-evaluation.model.js", () => ({
  CandidateEvaluationModel: {
    exists: vi.fn(),
  },
}))

vi.mock("../models/candidate-submission.model.js", () => ({
  CandidateSubmissionModel: {
    exists: vi.fn(),
  },
}))

vi.mock("../models/interview.model.js", () => ({
  InterviewModel: {
    exists: vi.fn(),
  },
}))

vi.mock("../models/offer.model.js", () => ({
  OfferModel: {
    exists: vi.fn(),
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

vi.mock("../utils/candidate-number.js", () => ({
  generateCandidateNumber: vi.fn().mockResolvedValue("CAND-2026-0001"),
  splitCandidateName: vi.fn((name: string) => {
    const parts = name.trim().split(/\s+/)
    return { firstName: parts[0] ?? name, lastName: parts.slice(1).join(" ") }
  }),
}))

vi.mock("../utils/activity.js", () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../utils/audit.js", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}))

const { CandidateModel } = await import("../models/candidate.model.js")
const { generateCandidateNumber } = await import("../utils/candidate-number.js")
const { createCandidate, getCandidate, listCandidates } = await import("./candidate.service.js")

const hr = auth("HR_ADMIN", IDS.hrUser)
const now = new Date("2026-08-30T10:00:00.000Z")

function makeCandidate(overrides: Record<string, unknown> = {}) {
  return {
    _id: IDS.candidate,
    id: IDS.candidate,
    organizationId: IDS.org,
    candidateNumber: "CAND-2026-0001",
    firstName: "Ada",
    lastName: "Lovelace",
    name: "Ada Lovelace",
    email: "ada@example.com",
    phone: "9876543210",
    resumeUrl: "https://files.example/ada.pdf",
    currentCompany: "Acme",
    currentDesignation: "Engineer",
    totalExperience: 5,
    relevantExperience: 3,
    currentCTC: 1200000,
    expectedCTC: 1500000,
    noticePeriod: "30 days",
    currentLocation: "Pune",
    preferredLocations: ["Pune", "Bengaluru"],
    skills: ["Java", "Spring"],
    qualifications: ["B.Tech"],
    source: "LINKEDIN",
    consent: { given: true, date: now, method: "FORM" },
    status: "NEW",
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

describe("candidate.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(generateCandidateNumber).mockResolvedValue("CAND-2026-0001")
  })

  it("scopes list queries to the authenticated organization", async () => {
    vi.mocked(CandidateModel.find).mockReturnValue(mockQuery([makeCandidate()]) as never)
    vi.mocked(CandidateModel.countDocuments).mockResolvedValue(1)

    const result = await listCandidates(hr, {
      search: "Ada",
      email: "ada",
      status: "NEW",
      skills: ["Java"],
      page: 1,
      limit: 20,
    })

    expect(CandidateModel.find).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        status: "NEW",
        email: expect.any(RegExp),
        $or: expect.any(Array),
      })
    )
    expect(result.items[0]?.candidateNumber).toBe("CAND-2026-0001")
  })

  it("rejects a duplicate email in the same organization", async () => {
    vi.mocked(CandidateModel.findOne).mockReturnValue(mockQuery({ _id: IDS.candidate }) as never)

    await expect(
      createCandidate(hr, {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: MESSAGES.CANDIDATE_EMAIL_IN_USE,
    } satisfies Partial<AppError>)

    expect(CandidateModel.create).not.toHaveBeenCalled()
  })

  it("rejects a duplicate phone in the same organization", async () => {
    vi.mocked(CandidateModel.findOne)
      .mockReturnValueOnce(mockQuery(null) as never)
      .mockReturnValueOnce(mockQuery({ _id: IDS.candidate }) as never)

    await expect(
      createCandidate(hr, {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada.new@example.com",
        phone: "9876543210",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: MESSAGES.CANDIDATE_PHONE_IN_USE,
    } satisfies Partial<AppError>)

    expect(CandidateModel.create).not.toHaveBeenCalled()
  })

  it("creates a candidate with a generated number and auth organizationId", async () => {
    vi.mocked(CandidateModel.findOne).mockReturnValue(mockQuery(null) as never)
    const created = makeCandidate()
    vi.mocked(CandidateModel.create).mockResolvedValue(created as never)

    const candidate = await createCandidate(hr, {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: "9876543210",
      skills: ["Java"],
      source: "LINKEDIN",
    })

    expect(generateCandidateNumber).toHaveBeenCalledWith(IDS.org)
    expect(CandidateModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        candidateNumber: "CAND-2026-0001",
        createdBy: IDS.hrUser,
        firstName: "Ada",
        lastName: "Lovelace",
        name: "Ada Lovelace",
        email: "ada@example.com",
      })
    )
    expect(candidate.candidateNumber).toBe("CAND-2026-0001")
  })

  it("does not return a candidate that belongs to another organization", async () => {
    vi.mocked(CandidateModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(getCandidate(hr, IDS.candidate)).rejects.toMatchObject({
      statusCode: 404,
      message: MESSAGES.CANDIDATE_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(CandidateModel.findOne).toHaveBeenCalledWith({
      _id: IDS.candidate,
      organizationId: IDS.org,
    })
  })
})
