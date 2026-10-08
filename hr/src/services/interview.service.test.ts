import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth, IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"

vi.mock("../models/interview.model.js", () => ({
  InterviewModel: {
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

vi.mock("../models/user.model.js", () => ({
  UserModel: {
    find: vi.fn(),
  },
}))

vi.mock("../utils/activity.js", () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../utils/audit.js", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}))

const { InterviewModel } = await import("../models/interview.model.js")
const { CandidateModel } = await import("../models/candidate.model.js")
const { RecruitmentMandateModel } = await import("../models/recruitment-mandate.model.js")
const { CandidateSubmissionModel } = await import("../models/candidate-submission.model.js")
const { createInterview, getInterview, listInterviews } = await import("./interview.service.js")

const hr = auth("HR_ADMIN", IDS.hrUser)
const now = new Date("2026-08-30T10:00:00.000Z")

function makeInterview(overrides: Record<string, unknown> = {}) {
  return {
    _id: IDS.interview,
    id: IDS.interview,
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
    round: 1,
    interviewType: "VIDEO",
    scheduledAt: now,
    duration: 60,
    interviewers: [{ _id: IDS.hrUser, name: "Pat Admin", email: "hr@example.com", role: "HR_ADMIN" }],
    status: "SCHEDULED",
    feedback: {
      technicalScore: 8,
      communicationScore: 7,
      cultureFitScore: 8,
      leadershipScore: 6,
      compensationFit: 7,
      joiningRisk: 3,
      comments: "Strong round",
    },
    decision: "NEXT_ROUND",
    nextAction: "Schedule round 2",
    createdAt: now,
    updatedAt: now,
    toObject() {
      return this
    },
    populate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("interview.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("scopes list queries to the authenticated organization", async () => {
    vi.mocked(InterviewModel.find).mockReturnValue(mockQuery([makeInterview()]) as never)
    vi.mocked(InterviewModel.countDocuments).mockResolvedValue(1)

    const result = await listInterviews(hr, {
      submissionId: IDS.submission,
      page: 1,
      limit: 20,
    })

    expect(InterviewModel.find).toHaveBeenCalledWith({
      organizationId: IDS.org,
      submissionId: IDS.submission,
    })
    expect(result.items[0]?.round).toBe(1)
  })

  it("rejects a submission from another organization", async () => {
    vi.mocked(CandidateSubmissionModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(
      createInterview(hr, {
        submissionId: IDS.submission,
        scheduledAt: now.toISOString(),
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MESSAGES.SUBMISSION_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(InterviewModel.create).not.toHaveBeenCalled()
  })

  it("creates an interview with organizationId from auth and derived candidate/mandate", async () => {
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
    vi.mocked(InterviewModel.findOne).mockReturnValue(mockQuery(null) as never)
    const created = makeInterview()
    vi.mocked(InterviewModel.create).mockResolvedValue(created as never)

    const interview = await createInterview(hr, {
      submissionId: IDS.submission,
      scheduledAt: now.toISOString(),
      interviewType: "VIDEO",
    })

    expect(InterviewModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        candidateId: IDS.candidate,
        mandateId: IDS.mandate,
        submissionId: IDS.submission,
        round: 1,
        status: "SCHEDULED",
      })
    )
    expect(interview.organizationId).toBe(IDS.org)
  })

  it("does not return an interview from another organization", async () => {
    vi.mocked(InterviewModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(getInterview(hr, IDS.interview)).rejects.toMatchObject({
      statusCode: 404,
      message: MESSAGES.INTERVIEW_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(InterviewModel.findOne).toHaveBeenCalledWith({
      _id: IDS.interview,
      organizationId: IDS.org,
    })
  })
})
