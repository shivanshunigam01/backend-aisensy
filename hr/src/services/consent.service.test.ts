import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth, IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"

vi.mock("../models/candidate-consent.model.js", () => ({
  CandidateConsentModel: {
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
    updateOne: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock("../models/recruitment-mandate.model.js", () => ({
  RecruitmentMandateModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../utils/activity.js", () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../utils/audit.js", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}))

const { CandidateConsentModel } = await import("../models/candidate-consent.model.js")
const { CandidateModel } = await import("../models/candidate.model.js")
const { RecruitmentMandateModel } = await import("../models/recruitment-mandate.model.js")
const { createConsent, getConsent, listConsents } = await import("./consent.service.js")

const hr = auth("HR_ADMIN", IDS.hrUser)
const now = new Date("2026-08-30T10:00:00.000Z")

function makeConsent(overrides: Record<string, unknown> = {}) {
  return {
    _id: IDS.consent,
    id: IDS.consent,
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
    consentGiven: true,
    consentDate: new Date("2026-08-01T00:00:00.000Z"),
    consentMethod: "FORM",
    consentPurpose: "SUBMISSION",
    consentDocument: { fileUrl: "https://files.example/consent.pdf", fileName: "consent.pdf" },
    expiryDate: new Date("2027-08-01T00:00:00.000Z"),
    withdrawnAt: null,
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

describe("consent.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("scopes list queries to the authenticated organization", async () => {
    vi.mocked(CandidateConsentModel.find).mockReturnValue(mockQuery([makeConsent()]) as never)
    vi.mocked(CandidateConsentModel.countDocuments).mockResolvedValue(1)

    const result = await listConsents(hr, {
      candidateId: IDS.candidate,
      mandateId: IDS.mandate,
      page: 1,
      limit: 20,
    })

    expect(CandidateConsentModel.find).toHaveBeenCalledWith({
      organizationId: IDS.org,
      candidateId: IDS.candidate,
      mandateId: IDS.mandate,
    })
    expect(result.items[0]?.consentMethod).toBe("FORM")
    expect(result.total).toBe(1)
  })

  it("rejects a candidate from another organization", async () => {
    vi.mocked(CandidateModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(
      createConsent(hr, { candidateId: IDS.candidate, mandateId: IDS.mandate })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MESSAGES.CANDIDATE_NOT_IN_ORGANIZATION,
    } satisfies Partial<AppError>)

    expect(CandidateConsentModel.create).not.toHaveBeenCalled()
  })

  it("creates consent with organizationId from auth", async () => {
    vi.mocked(CandidateModel.findOne).mockReturnValue(
      mockQuery({ _id: IDS.candidate, name: "Ada Lovelace" }) as never
    )
    vi.mocked(RecruitmentMandateModel.findOne).mockReturnValue(
      mockQuery({ _id: IDS.mandate, mandateNumber: "RM-2026-0001" }) as never
    )
    vi.mocked(CandidateConsentModel.findOne).mockReturnValue(mockQuery(null) as never)
    const created = makeConsent()
    vi.mocked(CandidateConsentModel.create).mockResolvedValue(created as never)

    const consent = await createConsent(hr, {
      candidateId: IDS.candidate,
      mandateId: IDS.mandate,
      consentMethod: "EMAIL",
      consentPurpose: "SUBMISSION",
    })

    expect(CandidateConsentModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        createdBy: IDS.hrUser,
        consentGiven: true,
        consentMethod: "EMAIL",
        consentPurpose: "SUBMISSION",
      })
    )
    expect(consent.organizationId).toBe(IDS.org)
  })

  it("does not return consent from another organization", async () => {
    vi.mocked(CandidateConsentModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(getConsent(hr, IDS.consent)).rejects.toMatchObject({
      statusCode: 404,
      message: MESSAGES.CONSENT_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(CandidateConsentModel.findOne).toHaveBeenCalledWith({
      _id: IDS.consent,
      organizationId: IDS.org,
    })
  })
})
