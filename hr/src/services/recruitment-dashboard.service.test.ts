import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth, IDS } from "../__tests__/helpers.js"

vi.mock("../models/client.model.js", () => ({
  ClientModel: { countDocuments: vi.fn() },
}))
vi.mock("../models/recruitment-mandate.model.js", () => ({
  RecruitmentMandateModel: {
    find: vi.fn(),
    countDocuments: vi.fn(),
    collection: { name: "recruitmentmandates" },
  },
}))
vi.mock("../models/candidate.model.js", () => ({
  CandidateModel: { countDocuments: vi.fn() },
}))
vi.mock("../models/candidate-evaluation.model.js", () => ({
  CandidateEvaluationModel: { countDocuments: vi.fn() },
}))
vi.mock("../models/candidate-submission.model.js", () => ({
  CandidateSubmissionModel: { countDocuments: vi.fn(), find: vi.fn(), aggregate: vi.fn() },
}))
vi.mock("../models/interview.model.js", () => ({
  InterviewModel: { countDocuments: vi.fn() },
}))
vi.mock("../models/offer.model.js", () => ({
  OfferModel: { countDocuments: vi.fn() },
}))
vi.mock("../models/joining.model.js", () => ({
  JoiningModel: { countDocuments: vi.fn(), find: vi.fn(), aggregate: vi.fn() },
}))
vi.mock("../models/invoice.model.js", () => ({
  InvoiceModel: { aggregate: vi.fn() },
}))
vi.mock("../models/guarantee-follow-up.model.js", () => ({
  GuaranteeFollowUpModel: { countDocuments: vi.fn() },
}))
vi.mock("../models/user.model.js", () => ({
  UserModel: { find: vi.fn() },
}))

const { ClientModel } = await import("../models/client.model.js")
const { RecruitmentMandateModel } = await import("../models/recruitment-mandate.model.js")
const { CandidateModel } = await import("../models/candidate.model.js")
const { CandidateEvaluationModel } = await import("../models/candidate-evaluation.model.js")
const { CandidateSubmissionModel } = await import("../models/candidate-submission.model.js")
const { InterviewModel } = await import("../models/interview.model.js")
const { OfferModel } = await import("../models/offer.model.js")
const { JoiningModel } = await import("../models/joining.model.js")
const { InvoiceModel } = await import("../models/invoice.model.js")
const { GuaranteeFollowUpModel } = await import("../models/guarantee-follow-up.model.js")
const { UserModel } = await import("../models/user.model.js")
const { getRecruitmentDashboard } = await import("./recruitment-dashboard.service.js")

const hr = auth("HR_ADMIN", IDS.hrUser)

function mockCounts() {
  vi.mocked(ClientModel.countDocuments).mockResolvedValue(3)
  vi.mocked(RecruitmentMandateModel.countDocuments).mockResolvedValue(4)
  vi.mocked(CandidateModel.countDocuments).mockResolvedValue(10)
  vi.mocked(CandidateEvaluationModel.countDocuments).mockResolvedValue(6)
  vi.mocked(CandidateSubmissionModel.countDocuments).mockResolvedValue(8)
  vi.mocked(InterviewModel.countDocuments).mockResolvedValue(5)
  vi.mocked(OfferModel.countDocuments).mockResolvedValue(2)
  vi.mocked(JoiningModel.countDocuments).mockResolvedValue(1)
  vi.mocked(GuaranteeFollowUpModel.countDocuments).mockResolvedValue(1)
  vi.mocked(InvoiceModel.aggregate)
    .mockResolvedValueOnce([{ revenue: 250000, outstanding: 40000 }] as never)
    .mockResolvedValueOnce([] as never)
  vi.mocked(CandidateSubmissionModel.aggregate).mockResolvedValue([{ avg: 4.2 }] as never)
  vi.mocked(JoiningModel.aggregate).mockResolvedValue([{ avg: 21 }] as never)
  vi.mocked(UserModel.find).mockReturnValue({ select: vi.fn().mockResolvedValue([]) } as never)
}

describe("recruitment-dashboard.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCounts()
  })

  it("scopes metrics to the authenticated organization", async () => {
    const result = await getRecruitmentDashboard(hr, {})

    expect(String(vi.mocked(ClientModel.countDocuments).mock.calls[0]?.[0]?.organizationId)).toBe(
      IDS.org
    )
    expect(result.metrics.activeClients).toBe(3)
    expect(result.metrics.openMandates).toBe(4)
    expect(result.metrics.revenue).toBe(250000)
    expect(result.metrics.outstandingReceivables).toBe(40000)
    expect(result.metrics.timeToFirstSubmissionDays).toBe(4.2)
  })

  it("returns zeros when a recruiter filter matches no mandates", async () => {
    vi.mocked(RecruitmentMandateModel.find).mockReturnValue({
      distinct: vi.fn().mockResolvedValue([]),
    } as never)

    const result = await getRecruitmentDashboard(hr, { recruiterId: IDS.hrUser })

    expect(result.metrics.totalCandidates).toBe(0)
    expect(result.metrics.revenue).toBe(0)
    expect(CandidateModel.countDocuments).not.toHaveBeenCalled()
  })

  it("applies a client filter to mandate-scoped collections", async () => {
    vi.mocked(RecruitmentMandateModel.find).mockReturnValue({
      distinct: vi.fn().mockResolvedValue([IDS.mandate]),
    } as never)
    vi.mocked(JoiningModel.find).mockReturnValue({
      distinct: vi.fn().mockResolvedValue([IDS.joining]),
    } as never)
    vi.mocked(CandidateSubmissionModel.find).mockReturnValue({
      distinct: vi.fn().mockResolvedValue([IDS.candidate]),
    } as never)

    await getRecruitmentDashboard(hr, { clientId: IDS.client })

    expect(RecruitmentMandateModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: IDS.client })
    )
    expect(vi.mocked(CandidateSubmissionModel.countDocuments).mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ clientId: IDS.client, mandateId: { $in: [IDS.mandate] } })
    )
    expect(vi.mocked(InvoiceModel.aggregate).mock.calls[0]?.[0]?.[0]?.$match.clientId.toString()).toBe(
      IDS.client
    )
  })
})
