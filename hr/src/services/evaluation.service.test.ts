import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth, IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"

vi.mock("../models/candidate-evaluation.model.js", () => ({
  CandidateEvaluationModel: {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndDelete: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock("../models/candidate-submission.model.js", () => ({
  CandidateSubmissionModel: {
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

const { CandidateEvaluationModel } = await import("../models/candidate-evaluation.model.js")
const { CandidateModel } = await import("../models/candidate.model.js")
const { RecruitmentMandateModel } = await import("../models/recruitment-mandate.model.js")
const { UserModel } = await import("../models/user.model.js")
const { createEvaluation, getEvaluation, listEvaluations } = await import("./evaluation.service.js")

const hr = auth("HR_ADMIN", IDS.hrUser)
const now = new Date("2026-08-30T10:00:00.000Z")

const scores = {
  roleFit: 8,
  experienceFit: 7,
  communication: 9,
  industryExperience: 6,
  compensationFit: 8,
  joiningProbability: 7,
}

function makeEvaluation(overrides: Record<string, unknown> = {}) {
  return {
    _id: IDS.evaluation,
    id: IDS.evaluation,
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
    recruiterId: { _id: IDS.hrUser, name: "Pat Admin", email: "hr@example.com", role: "HR_ADMIN" },
    scores,
    totalScore: 7.5,
    recommendation: "RECOMMENDED",
    strengths: ["Strong communication"],
    concerns: ["Notice period"],
    remarks: "Ready to submit",
    evaluatedAt: now,
    createdAt: now,
    updatedAt: now,
    toObject() {
      return this
    },
    populate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("evaluation.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("scopes list queries to the authenticated organization", async () => {
    vi.mocked(CandidateEvaluationModel.find).mockReturnValue(mockQuery([makeEvaluation()]) as never)
    vi.mocked(CandidateEvaluationModel.countDocuments).mockResolvedValue(1)

    const result = await listEvaluations(hr, {
      candidateId: IDS.candidate,
      mandateId: IDS.mandate,
      page: 1,
      limit: 20,
    })

    expect(CandidateEvaluationModel.find).toHaveBeenCalledWith({
      organizationId: IDS.org,
      candidateId: IDS.candidate,
      mandateId: IDS.mandate,
    })
    expect(result.items[0]?.totalScore).toBe(7.5)
  })

  it("rejects a candidate from another organization", async () => {
    vi.mocked(CandidateModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(
      createEvaluation(hr, {
        candidateId: IDS.candidate,
        mandateId: IDS.mandate,
        scores,
        recommendation: "RECOMMENDED",
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MESSAGES.CANDIDATE_NOT_IN_ORGANIZATION,
    } satisfies Partial<AppError>)

    expect(CandidateEvaluationModel.create).not.toHaveBeenCalled()
  })

  it("creates an evaluation with calculated totalScore and auth organizationId", async () => {
    vi.mocked(CandidateModel.findOne).mockReturnValue(
      mockQuery({ _id: IDS.candidate, name: "Ada Lovelace" }) as never
    )
    vi.mocked(RecruitmentMandateModel.findOne).mockReturnValue(
      mockQuery({ _id: IDS.mandate, mandateNumber: "RM-2026-0001" }) as never
    )
    vi.mocked(UserModel.findOne).mockReturnValue(mockQuery({ _id: IDS.hrUser }) as never)
    const created = makeEvaluation()
    vi.mocked(CandidateEvaluationModel.create).mockResolvedValue(created as never)

    const evaluation = await createEvaluation(hr, {
      candidateId: IDS.candidate,
      mandateId: IDS.mandate,
      scores,
      recommendation: "RECOMMENDED",
    })

    expect(CandidateEvaluationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        recruiterId: IDS.hrUser,
        totalScore: 7.5,
        recommendation: "RECOMMEND",
        scoringVersion: "LEGACY_6",
      })
    )
    expect(evaluation.organizationId).toBe(IDS.org)
    expect(evaluation.totalScore).toBe(7.5)
  })

  it("does not return an evaluation from another organization", async () => {
    vi.mocked(CandidateEvaluationModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(getEvaluation(hr, IDS.evaluation)).rejects.toMatchObject({
      statusCode: 404,
      message: MESSAGES.EVALUATION_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(CandidateEvaluationModel.findOne).toHaveBeenCalledWith({
      _id: IDS.evaluation,
      organizationId: IDS.org,
    })
  })
})
