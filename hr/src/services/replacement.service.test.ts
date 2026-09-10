import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth, IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"

vi.mock("../models/replacement-case.model.js", () => ({
  ReplacementCaseModel: {
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

vi.mock("../models/invoice.model.js", () => ({
  InvoiceModel: {
    find: vi.fn(),
  },
}))

vi.mock("../utils/activity.js", () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("../utils/audit.js", () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}))

const { ReplacementCaseModel } = await import("../models/replacement-case.model.js")
const { CandidateModel } = await import("../models/candidate.model.js")
const { ClientModel } = await import("../models/client.model.js")
const { JoiningModel } = await import("../models/joining.model.js")
const { RecruitmentMandateModel } = await import("../models/recruitment-mandate.model.js")
const { InvoiceModel } = await import("../models/invoice.model.js")
const { createReplacement, getReplacement, listReplacements } = await import("./replacement.service.js")

const hr = auth("HR_ADMIN", IDS.hrUser)
const now = new Date("2026-08-30T10:00:00.000Z")

function makeReplacement(overrides: Record<string, unknown> = {}) {
  return {
    _id: IDS.replacementCase,
    id: IDS.replacementCase,
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
    replacementReason: "PERFORMANCE",
    replacementRequestedDate: now,
    status: "REPLACEMENT_REQUESTED",
    replacementCandidateId: null,
    closedAt: null,
    remarks: "",
    createdAt: now,
    updatedAt: now,
    toObject() {
      return this
    },
    populate: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("replacement.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("scopes list queries to the authenticated organization", async () => {
    vi.mocked(ReplacementCaseModel.find).mockReturnValue(mockQuery([makeReplacement()]) as never)
    vi.mocked(ReplacementCaseModel.countDocuments).mockResolvedValue(1)

    const result = await listReplacements(hr, {
      joiningId: IDS.joining,
      page: 1,
      limit: 20,
    })

    expect(ReplacementCaseModel.find).toHaveBeenCalledWith({
      organizationId: IDS.org,
      joiningId: IDS.joining,
    })
    expect(result.items[0]?.status).toBe("REPLACEMENT_REQUESTED")
  })

  it("rejects a joining from another organization", async () => {
    vi.mocked(JoiningModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(
      createReplacement(hr, { joiningId: IDS.joining, replacementReason: "PERFORMANCE" })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MESSAGES.JOINING_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(ReplacementCaseModel.create).not.toHaveBeenCalled()
  })

  it("creates a replacement with organizationId from auth and related ids from the joining", async () => {
    const joiningDate = new Date("2026-08-01T00:00:00.000Z")
    vi.mocked(JoiningModel.findOne).mockReturnValue(
      mockQuery({
        _id: IDS.joining,
        candidateId: IDS.candidate,
        mandateId: IDS.mandate,
        clientId: IDS.client,
        joiningDate,
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
    vi.mocked(InvoiceModel.find).mockReturnValue({
      select: vi.fn().mockResolvedValue([
        { status: "PAID", outstandingAmount: 0, dueDate: new Date("2026-08-20T00:00:00.000Z") },
      ]),
    } as never)
    vi.mocked(ReplacementCaseModel.countDocuments).mockResolvedValue(0)
    vi.mocked(ReplacementCaseModel.findOne).mockReturnValue(mockQuery(null) as never)
    const created = makeReplacement({
      joiningId: { _id: IDS.joining, joiningDate, status: "JOINED" },
      eligibilityResult: "APPROVED",
    })
    vi.mocked(ReplacementCaseModel.create).mockResolvedValue(created as never)

    const replacement = await createReplacement(hr, {
      joiningId: IDS.joining,
      replacementReason: "PERFORMANCE",
      replacementRequestedDate: "2026-08-30",
    })

    expect(ReplacementCaseModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        candidateId: IDS.candidate,
        joiningId: IDS.joining,
        mandateId: IDS.mandate,
        clientId: IDS.client,
        replacementReason: "PERFORMANCE",
        status: "REPLACEMENT_REQUESTED",
        eligibilityResult: "APPROVED",
      })
    )
    expect(replacement.organizationId).toBe(IDS.org)
  })

  it("does not return a replacement from another organization", async () => {
    vi.mocked(ReplacementCaseModel.findOne).mockReturnValue(mockQuery(null) as never)

    await expect(getReplacement(hr, IDS.replacementCase)).rejects.toMatchObject({
      statusCode: 404,
      message: MESSAGES.REPLACEMENT_NOT_FOUND,
    } satisfies Partial<AppError>)

    expect(ReplacementCaseModel.findOne).toHaveBeenCalledWith({
      _id: IDS.replacementCase,
      organizationId: IDS.org,
    })
  })
})
