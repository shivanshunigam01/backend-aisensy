import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth, IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"

vi.mock("../models/recruitment-mandate.model.js", () => ({
  RecruitmentMandateModel: {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndDelete: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock("../models/client.model.js", () => ({
  ClientModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../models/client-agreement.model.js", () => ({
  ClientAgreementModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../models/user.model.js", () => ({
  UserModel: {
    find: vi.fn(),
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

vi.mock("../models/job-application.model.js", () => ({
  JobApplicationModel: {
    exists: vi.fn(),
  },
}))

vi.mock("../utils/publish-mandate-job.js", () => ({
  syncJobForMandate: vi.fn().mockResolvedValue(null),
  closeJobForMandate: vi.fn().mockResolvedValue(undefined),
  findJobsByMandateIds: vi.fn().mockResolvedValue(new Map()),
}))

vi.mock("../utils/mandate-number.js", () => ({
  generateMandateNumber: vi.fn().mockResolvedValue("RM-2026-0001"),
}))

vi.mock("../utils/activity.js", () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../utils/audit.js", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}))

const { RecruitmentMandateModel } = await import("../models/recruitment-mandate.model.js")
const { ClientModel } = await import("../models/client.model.js")
const { ClientAgreementModel } = await import("../models/client-agreement.model.js")
const { UserModel } = await import("../models/user.model.js")
const { generateMandateNumber } = await import("../utils/mandate-number.js")
const { findJobsByMandateIds, syncJobForMandate } = await import("../utils/publish-mandate-job.js")
const { createMandate, getMandate, listMandates } = await import("./mandate.service.js")

const hr = auth("HR_ADMIN", IDS.hrUser)
const now = new Date("2026-08-30T10:00:00.000Z")

function makeMandate(overrides: Record<string, unknown> = {}) {
  return {
    _id: IDS.mandate,
    id: IDS.mandate,
    organizationId: IDS.org,
    clientId: {
      _id: IDS.client,
      companyName: "Acme Staffing",
      status: "ACTIVE",
      industry: "IT",
    },
    agreementId: {
      _id: IDS.agreement,
      agreementNumber: "CA-2026-0001",
      status: "ACTIVE",
    },
    mandateNumber: "RM-2026-0001",
    position: "Senior Recruiter",
    department: "Talent",
    employmentType: "full_time",
    vacancies: 2,
    location: "Pune",
    workMode: "HYBRID",
    reportingTo: "CHRO",
    experience: { minimum: 3, maximum: 6 },
    salary: { minimum: 800000, maximum: 1200000, currency: "INR" },
    qualifications: ["MBA"],
    skills: ["Sourcing"],
    responsibilities: ["Fill mandates"],
    criticalRequirements: ["Notice <= 30 days"],
    interviewProcess: ["Screening", "Client interview"],
    assignedRecruiters: [{ _id: IDS.hrUser, name: "Pat Admin", email: "hr@example.com", role: "HR_ADMIN" }],
    recruitmentFee: 8.33,
    feeType: "PERCENTAGE",
    replacementPeriodDays: 90,
    priority: "HIGH",
    status: "OPEN",
    createdBy: { _id: IDS.hrUser, name: "Pat Admin", email: "hr@example.com" },
    createdAt: now,
    updatedAt: now,
    toObject() {
      return this
    },
    populate: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    set: vi.fn(),
    ...overrides,
  }
}

describe("mandate.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(generateMandateNumber).mockResolvedValue("RM-2026-0001")
    vi.mocked(findJobsByMandateIds).mockResolvedValue(new Map())
    vi.mocked(syncJobForMandate).mockResolvedValue(null)
  })

  it("scopes list queries to the authenticated organization and supports filters", async () => {
    vi.mocked(RecruitmentMandateModel.find).mockReturnValue(mockQuery([makeMandate()]) as never)
    vi.mocked(RecruitmentMandateModel.countDocuments).mockResolvedValue(1)

    const result = await listMandates(hr, {
      search: "Recruiter",
      status: "OPEN",
      priority: "HIGH",
      clientId: IDS.client,
      recruiterId: IDS.hrUser,
      page: 1,
      limit: 20,
    })

    expect(RecruitmentMandateModel.find).toHaveBeenCalledWith({
      organizationId: IDS.org,
      status: "OPEN",
      priority: "HIGH",
      clientId: IDS.client,
      assignedRecruiters: IDS.hrUser,
      $or: expect.any(Array),
    })
    expect(result.items[0]?.mandateNumber).toBe("RM-2026-0001")
    expect(result.total).toBe(1)
  })

  it("rejects a client from another organization", async () => {
    vi.mocked(ClientModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(
      createMandate(hr, { clientId: IDS.client, agreementId: IDS.agreement, position: "Engineer" })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MESSAGES.CLIENT_NOT_IN_ORGANIZATION,
    } satisfies Partial<AppError>)

    expect(ClientModel.findOne).toHaveBeenCalledWith(
      { _id: IDS.client, organizationId: IDS.org },
    )
    expect(RecruitmentMandateModel.create).not.toHaveBeenCalled()
  })

  it("creates a mandate with a generated number and auth organizationId", async () => {
    vi.mocked(ClientModel.findOne).mockReturnValue(
      mockQuery({ _id: IDS.client, companyName: "Acme Staffing" }) as never
    )
    vi.mocked(ClientAgreementModel.findOne).mockReturnValue(
      mockQuery({
        _id: IDS.agreement,
        clientId: IDS.client,
        agreementNumber: "CA-2026-0001",
        commercialTerms: { recruitmentFee: 8.33, feeType: "PERCENTAGE" },
        replacementPeriodDays: 90,
      }) as never
    )
    vi.mocked(UserModel.find).mockReturnValue(mockQuery([{ _id: IDS.hrUser }]) as never)
    const created = makeMandate()
    vi.mocked(RecruitmentMandateModel.create).mockResolvedValue(created as never)

    const mandate = await createMandate(hr, {
      clientId: IDS.client,
      agreementId: IDS.agreement,
      position: "Senior Recruiter",
      assignedRecruiters: [IDS.hrUser],
      status: "OPEN",
    })

    expect(generateMandateNumber).toHaveBeenCalledWith(IDS.org)
    expect(RecruitmentMandateModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        agreementId: IDS.agreement,
        mandateNumber: "RM-2026-0001",
        createdBy: IDS.hrUser,
        position: "Senior Recruiter",
        assignedRecruiters: [IDS.hrUser],
      })
    )
    expect(mandate.mandateNumber).toBe("RM-2026-0001")
  })

  it("does not return a mandate that belongs to another organization", async () => {
    vi.mocked(RecruitmentMandateModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(getMandate(hr, IDS.mandate)).rejects.toMatchObject({
      statusCode: 404,
      message: MESSAGES.MANDATE_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(RecruitmentMandateModel.findOne).toHaveBeenCalledWith({
      _id: IDS.mandate,
      organizationId: IDS.org,
    })
  })
})
