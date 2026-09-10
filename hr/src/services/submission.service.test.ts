import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth, IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"

vi.mock("../models/candidate-submission.model.js", () => ({
  CandidateSubmissionModel: {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndDelete: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
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

vi.mock("../models/recruitment-mandate.model.js", () => ({
  RecruitmentMandateModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../models/candidate-evaluation.model.js", () => ({
  CandidateEvaluationModel: {
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

vi.mock("../utils/audit.js", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}))

const { CandidateSubmissionModel } = await import("../models/candidate-submission.model.js")
const { CandidateModel } = await import("../models/candidate.model.js")
const { ClientModel } = await import("../models/client.model.js")
const { RecruitmentMandateModel } = await import("../models/recruitment-mandate.model.js")
const { UserModel } = await import("../models/user.model.js")
const { createSubmission, getSubmission, listSubmissions } = await import("./submission.service.js")

const hr = auth("HR_ADMIN", IDS.hrUser)
const now = new Date("2026-08-30T10:00:00.000Z")

function makeSubmission(overrides: Record<string, unknown> = {}) {
  return {
    _id: IDS.submission,
    id: IDS.submission,
    organizationId: IDS.org,
    candidateId: {
      _id: IDS.candidate,
      name: "Ada Lovelace",
      email: "ada@example.com",
      candidateNumber: "CAND-2026-0001",
    },
    clientId: { _id: IDS.client, companyName: "Acme Staffing", status: "ACTIVE" },
    mandateId: {
      _id: IDS.mandate,
      mandateNumber: "RM-2026-0001",
      position: "Engineer",
      status: "OPEN",
      clientId: IDS.client,
    },
    evaluationId: { _id: IDS.evaluation, totalScore: 7.5, recommendation: "RECOMMENDED" },
    submittedBy: { _id: IDS.hrUser, name: "Pat Admin", email: "hr@example.com", role: "HR_ADMIN" },
    submittedAt: now,
    ownershipStartDate: now,
    ownershipEndDate: new Date("2026-09-30T00:00:00.000Z"),
    clientAcknowledgement: false,
    acknowledgementDate: null,
    duplicateStatus: "NOT_CHECKED",
    duplicateEvidence: "",
    status: "SUBMITTED",
    remarks: "First submission",
    createdAt: now,
    updatedAt: now,
    toObject() {
      return this
    },
    populate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("submission.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("scopes list queries to the authenticated organization", async () => {
    vi.mocked(CandidateSubmissionModel.find).mockReturnValue(mockQuery([makeSubmission()]) as never)
    vi.mocked(CandidateSubmissionModel.countDocuments).mockResolvedValue(1)

    const result = await listSubmissions(hr, {
      candidateId: IDS.candidate,
      mandateId: IDS.mandate,
      page: 1,
      limit: 20,
    })

    expect(CandidateSubmissionModel.find).toHaveBeenCalledWith({
      organizationId: IDS.org,
      candidateId: IDS.candidate,
      mandateId: IDS.mandate,
    })
    expect(result.items[0]?.status).toBe("SUBMITTED")
  })

  it("rejects a candidate from another organization", async () => {
    vi.mocked(CandidateModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(
      createSubmission(hr, { candidateId: IDS.candidate, mandateId: IDS.mandate })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MESSAGES.CANDIDATE_NOT_IN_ORGANIZATION,
    } satisfies Partial<AppError>)

    expect(CandidateSubmissionModel.create).not.toHaveBeenCalled()
  })

  it("creates a submission with organizationId from auth and prevents an active duplicate", async () => {
    vi.mocked(CandidateModel.findOne).mockReturnValue(
      mockQuery({ _id: IDS.candidate, name: "Ada Lovelace" }) as never
    )
    vi.mocked(RecruitmentMandateModel.findOne).mockReturnValue(
      mockQuery({
        _id: IDS.mandate,
        mandateNumber: "RM-2026-0001",
        clientId: IDS.client,
      }) as never
    )
    vi.mocked(ClientModel.findOne).mockReturnValue(
      mockQuery({ _id: IDS.client, companyName: "Acme Staffing" }) as never
    )
    vi.mocked(UserModel.findOne).mockReturnValue(mockQuery({ _id: IDS.hrUser }) as never)
    vi.mocked(CandidateSubmissionModel.findOne).mockReturnValue(mockQuery(null) as never)
    const created = makeSubmission({ status: "DRAFT", submittedAt: null })
    vi.mocked(CandidateSubmissionModel.create).mockResolvedValue(created as never)

    const submission = await createSubmission(hr, {
      candidateId: IDS.candidate,
      mandateId: IDS.mandate,
      status: "DRAFT",
    })

    expect(CandidateSubmissionModel.findOne).toHaveBeenCalledWith({
      organizationId: IDS.org,
      candidateId: IDS.candidate,
      mandateId: IDS.mandate,
      status: { $in: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "SHORTLISTED"] },
    })
    expect(CandidateSubmissionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        clientId: IDS.client,
        submittedBy: IDS.hrUser,
        status: "DRAFT",
      })
    )
    expect(submission.organizationId).toBe(IDS.org)
  })

  it("does not return a submission from another organization", async () => {
    vi.mocked(CandidateSubmissionModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(getSubmission(hr, IDS.submission)).rejects.toMatchObject({
      statusCode: 404,
      message: MESSAGES.SUBMISSION_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(CandidateSubmissionModel.findOne).toHaveBeenCalledWith({
      _id: IDS.submission,
      organizationId: IDS.org,
    })
  })
})
