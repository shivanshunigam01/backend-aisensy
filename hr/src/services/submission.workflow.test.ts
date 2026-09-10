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
  InterviewModel: { exists: vi.fn() },
}))

vi.mock("../models/offer.model.js", () => ({
  OfferModel: { exists: vi.fn() },
}))

vi.mock("../models/candidate.model.js", () => ({
  CandidateModel: { findOne: vi.fn() },
}))

vi.mock("../models/client.model.js", () => ({
  ClientModel: { findOne: vi.fn() },
}))

vi.mock("../models/recruitment-mandate.model.js", () => ({
  RecruitmentMandateModel: { findOne: vi.fn() },
}))

vi.mock("../models/candidate-evaluation.model.js", () => ({
  CandidateEvaluationModel: { findOne: vi.fn() },
}))

vi.mock("../models/user.model.js", () => ({
  UserModel: { findOne: vi.fn() },
}))

vi.mock("../utils/activity.js", () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../utils/audit.js", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../utils/placement-workflow.js", () => ({
  assertSubmissionWorkflowReady: vi.fn(),
}))

const { CandidateSubmissionModel } = await import("../models/candidate-submission.model.js")
const { CandidateModel } = await import("../models/candidate.model.js")
const { ClientModel } = await import("../models/client.model.js")
const { RecruitmentMandateModel } = await import("../models/recruitment-mandate.model.js")
const { UserModel } = await import("../models/user.model.js")
const { assertSubmissionWorkflowReady } = await import("../utils/placement-workflow.js")
const { createSubmission } = await import("./submission.service.js")

const hr = auth("HR_ADMIN", IDS.hrUser)

describe("submission workflow gates", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(CandidateModel.findOne).mockReturnValue(
      mockQuery({
        _id: IDS.candidate,
        name: "Ada Lovelace",
        currentCompany: "Acme",
        currentDesignation: "Engineer",
        currentLocation: "Bengaluru",
        totalExperience: 5,
        currentCTC: 1000000,
        expectedCTC: 1200000,
        noticePeriod: "30 days",
      }) as never
    )
    vi.mocked(RecruitmentMandateModel.findOne).mockReturnValue(
      mockQuery({
        _id: IDS.mandate,
        mandateNumber: "RM-2026-0001",
        clientId: IDS.client,
        status: "OPEN",
      }) as never
    )
    vi.mocked(ClientModel.findOne).mockReturnValue(
      mockQuery({ _id: IDS.client, companyName: "Acme Staffing", status: "ACTIVE" }) as never
    )
    vi.mocked(UserModel.findOne).mockReturnValue(mockQuery({ _id: IDS.hrUser }) as never)
    vi.mocked(CandidateSubmissionModel.findOne).mockReturnValue(mockQuery(null) as never)
  })

  it("blocks introduction when consent/evaluation workflow fails", async () => {
    vi.mocked(assertSubmissionWorkflowReady).mockRejectedValue(
      AppError.badRequest(MESSAGES.SUBMISSION_CONSENT_REQUIRED)
    )

    await expect(
      createSubmission(hr, {
        candidateId: IDS.candidate,
        mandateId: IDS.mandate,
        status: "SUBMITTED",
        fitReasons: ["Strong role match"],
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MESSAGES.SUBMISSION_CONSENT_REQUIRED,
    })

    expect(CandidateSubmissionModel.create).not.toHaveBeenCalled()
  })

  it("requires fit reasons when introducing", async () => {
    vi.mocked(assertSubmissionWorkflowReady).mockResolvedValue({
      evaluation: { _id: IDS.evaluation, totalScore: 82 },
      commercial: {
        ownershipPeriodMonths: 12,
        duplicateNotificationDays: 3,
      },
    } as never)

    await expect(
      createSubmission(hr, {
        candidateId: IDS.candidate,
        mandateId: IDS.mandate,
        status: "SUBMITTED",
        fitReasons: [],
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MESSAGES.SUBMISSION_FIT_REASONS_REQUIRED,
    })
  })

  it("allows DRAFT without workflow gates", async () => {
    const created = {
      _id: IDS.submission,
      organizationId: IDS.org,
      candidateId: { _id: IDS.candidate, name: "Ada Lovelace" },
      clientId: { _id: IDS.client, companyName: "Acme Staffing" },
      mandateId: { _id: IDS.mandate, mandateNumber: "RM-2026-0001", position: "Engineer" },
      submittedBy: { _id: IDS.hrUser, name: "Pat Admin" },
      status: "DRAFT",
      fitReasons: [],
      risksGaps: [],
      toObject() {
        return this
      },
      populate: vi.fn().mockResolvedValue(undefined),
    }
    vi.mocked(CandidateSubmissionModel.create).mockResolvedValue(created as never)

    const result = await createSubmission(hr, {
      candidateId: IDS.candidate,
      mandateId: IDS.mandate,
      status: "DRAFT",
    })

    expect(assertSubmissionWorkflowReady).not.toHaveBeenCalled()
    expect(result.status).toBe("DRAFT")
  })
})
