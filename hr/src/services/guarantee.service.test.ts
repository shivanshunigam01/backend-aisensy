import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth, IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"

vi.mock("../models/guarantee-follow-up.model.js", () => ({
  GuaranteeFollowUpModel: {
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

vi.mock("../models/client.model.js", () => ({
  ClientModel: {
    findOne: vi.fn(),
  },
}))

vi.mock("../models/joining.model.js", () => ({
  JoiningModel: {
    findOne: vi.fn(),
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

const { GuaranteeFollowUpModel } = await import("../models/guarantee-follow-up.model.js")
const { CandidateModel } = await import("../models/candidate.model.js")
const { ClientModel } = await import("../models/client.model.js")
const { JoiningModel } = await import("../models/joining.model.js")
const { RecruitmentMandateModel } = await import("../models/recruitment-mandate.model.js")
const { createGuarantee, getGuarantee, listGuarantees } = await import("./guarantee.service.js")

const hr = auth("HR_ADMIN", IDS.hrUser)
const now = new Date("2026-08-30T10:00:00.000Z")

function makeGuarantee(overrides: Record<string, unknown> = {}) {
  return {
    _id: IDS.guarantee,
    id: IDS.guarantee,
    organizationId: IDS.org,
    candidateId: {
      _id: IDS.candidate,
      name: "Ada Lovelace",
      email: "ada@example.com",
      candidateNumber: "CAND-2026-0001",
    },
    joiningId: { _id: IDS.joining, joiningDate: now, status: "JOINED" },
    mandateId: {
      _id: IDS.mandate,
      mandateNumber: "RM-2026-0001",
      position: "Engineer",
      status: "OPEN",
    },
    clientId: { _id: IDS.client, companyName: "Acme Corp" },
    joiningDate: now,
    guaranteeStartDate: now,
    guaranteeEndDate: new Date("2026-11-28T00:00:00.000Z"),
    milestone30: { status: "PENDING", completedAt: null, clientFeedback: "", candidateFeedback: "" },
    milestone60: { status: "PENDING", completedAt: null, clientFeedback: "", candidateFeedback: "" },
    milestone90: { status: "PENDING", completedAt: null, clientFeedback: "", candidateFeedback: "" },
    retentionStatus: "IN_PROGRESS",
    createdAt: now,
    updatedAt: now,
    toObject() {
      return this
    },
    populate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("guarantee.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("scopes list queries to the authenticated organization", async () => {
    vi.mocked(GuaranteeFollowUpModel.find).mockReturnValue(mockQuery([makeGuarantee()]) as never)
    vi.mocked(GuaranteeFollowUpModel.countDocuments).mockResolvedValue(1)

    const result = await listGuarantees(hr, {
      joiningId: IDS.joining,
      page: 1,
      limit: 20,
    })

    expect(GuaranteeFollowUpModel.find).toHaveBeenCalledWith({
      organizationId: IDS.org,
      joiningId: IDS.joining,
    })
    expect(result.items[0]?.retentionStatus).toBe("IN_PROGRESS")
  })

  it("rejects a joining from another organization", async () => {
    vi.mocked(JoiningModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(createGuarantee(hr, { joiningId: IDS.joining })).rejects.toMatchObject({
      statusCode: 400,
      message: MESSAGES.JOINING_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(GuaranteeFollowUpModel.create).not.toHaveBeenCalled()
  })

  it("creates a guarantee with organizationId from auth and related ids from the joining", async () => {
    vi.mocked(JoiningModel.findOne).mockReturnValue(
      mockQuery({
        _id: IDS.joining,
        candidateId: IDS.candidate,
        mandateId: IDS.mandate,
        clientId: IDS.client,
        joiningDate: now,
        status: "JOINED",
      }) as never
    )
    vi.mocked(CandidateModel.findOne).mockReturnValue(
      mockQuery({ _id: IDS.candidate, name: "Ada Lovelace" }) as never
    )
    vi.mocked(RecruitmentMandateModel.findOne).mockReturnValue(
      mockQuery({
        _id: IDS.mandate,
        mandateNumber: "RM-2026-0001",
        replacementPeriodDays: 90,
      }) as never
    )
    vi.mocked(ClientModel.findOne).mockReturnValue(
      mockQuery({ _id: IDS.client, companyName: "Acme Corp" }) as never
    )
    vi.mocked(GuaranteeFollowUpModel.findOne).mockReturnValue(mockQuery(null) as never)
    const created = makeGuarantee()
    vi.mocked(GuaranteeFollowUpModel.create).mockResolvedValue(created as never)

    const guarantee = await createGuarantee(hr, { joiningId: IDS.joining })

    expect(GuaranteeFollowUpModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        candidateId: IDS.candidate,
        joiningId: IDS.joining,
        mandateId: IDS.mandate,
        clientId: IDS.client,
        retentionStatus: "IN_PROGRESS",
        milestone30Enabled: true,
        milestone60Enabled: true,
        milestone90Enabled: true,
        replacementPeriodDays: 90,
      })
    )
    expect(guarantee.organizationId).toBe(IDS.org)
  })

  it("does not return a guarantee from another organization", async () => {
    vi.mocked(GuaranteeFollowUpModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(getGuarantee(hr, IDS.guarantee)).rejects.toMatchObject({
      statusCode: 404,
      message: MESSAGES.GUARANTEE_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(GuaranteeFollowUpModel.findOne).toHaveBeenCalledWith({
      _id: IDS.guarantee,
      organizationId: IDS.org,
    })
  })
})
