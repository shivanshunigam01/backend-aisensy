import { beforeEach, describe, expect, it, vi } from "vitest"

import { IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"

vi.mock("../models/organization.model.js", () => ({
  OrganizationModel: { findOne: vi.fn() },
}))

vi.mock("../models/job.model.js", () => ({
  JobModel: { find: vi.fn(), findOne: vi.fn() },
}))

vi.mock("../models/candidate.model.js", () => ({
  CandidateModel: { findOne: vi.fn(), create: vi.fn() },
}))

vi.mock("../models/application.model.js", () => ({
  ApplicationModel: { findOne: vi.fn(), create: vi.fn() },
}))

vi.mock("../models/candidate-submission.model.js", () => ({
  CandidateSubmissionModel: { create: vi.fn() },
}))

vi.mock("../models/recruitment-mandate.model.js", () => ({
  RecruitmentMandateModel: { findOne: vi.fn() },
}))

vi.mock("../utils/candidate-number.js", () => ({
  generateCandidateNumber: vi.fn().mockResolvedValue("CAND-2026-0001"),
  splitCandidateName: (name: string) => {
    const [firstName, ...rest] = name.split(" ")
    return { firstName, lastName: rest.join(" ") }
  },
}))

vi.mock("../utils/activity.js", () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}))

const { OrganizationModel } = await import("../models/organization.model.js")
const { JobModel } = await import("../models/job.model.js")
const { CandidateModel } = await import("../models/candidate.model.js")
const { ApplicationModel } = await import("../models/application.model.js")
const { CandidateSubmissionModel } = await import("../models/candidate-submission.model.js")
const { RecruitmentMandateModel } = await import("../models/recruitment-mandate.model.js")
const { applyToCareerJob, listCareerJobs } = await import("./career.service.js")

const org = {
  _id: IDS.org,
  name: "Acme",
  slug: "acme",
  logo: "",
  industry: "IT",
}

const job = {
  _id: IDS.job,
  organizationId: IDS.org,
  mandateId: IDS.mandate,
  title: "Engineer",
  status: "open",
  departmentName: "Eng",
  location: "Pune",
  employmentType: "full_time",
  description: "Build things",
  workMode: "HYBRID",
  skills: ["TypeScript"],
  experienceMinimum: 2,
  experienceMaximum: 5,
  vacancies: 1,
  createdAt: new Date("2026-08-30T10:00:00.000Z"),
}

describe("career.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(OrganizationModel.findOne).mockReturnValue(mockQuery(org) as never)
  })

  it("lists only open jobs for a public organization slug", async () => {
    vi.mocked(JobModel.find).mockReturnValue(mockQuery([job]) as never)

    const result = await listCareerJobs("acme", {})

    expect(OrganizationModel.findOne).toHaveBeenCalledWith({ slug: "acme" })
    expect(JobModel.find).toHaveBeenCalledWith({
      organizationId: org._id,
      status: "open",
    })
    expect(result.jobs[0]?.title).toBe("Engineer")
    expect(result.organization.slug).toBe("acme")
  })

  it("creates a candidate, application, and draft submission on apply", async () => {
    vi.mocked(JobModel.findOne).mockReturnValue(mockQuery(job) as never)
    vi.mocked(CandidateModel.findOne).mockResolvedValue(null)
    vi.mocked(CandidateModel.create).mockResolvedValue({
      _id: IDS.candidate,
      name: "Alex Candidate",
    } as never)
    vi.mocked(ApplicationModel.findOne).mockReturnValue(mockQuery(null) as never)
    vi.mocked(ApplicationModel.create).mockResolvedValue({ _id: "64a00000000000000000001b" } as never)
    vi.mocked(RecruitmentMandateModel.findOne).mockReturnValue(
      mockQuery({
        _id: IDS.mandate,
        clientId: IDS.client,
        createdBy: IDS.hrUser,
        assignedRecruiters: [],
      }) as never
    )
    vi.mocked(CandidateSubmissionModel.create).mockResolvedValue({} as never)

    const result = await applyToCareerJob("acme", IDS.job, {
      name: "Alex Candidate",
      email: "alex@example.com",
      experience: 3,
      skills: ["TypeScript"],
      consent: true,
    })

    expect(result.applied).toBe(true)
    expect(CandidateModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        email: "alex@example.com",
        source: "WEBSITE",
      })
    )
    expect(ApplicationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        jobId: job._id,
        stage: "applied",
      })
    )
    expect(CandidateSubmissionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mandateId: IDS.mandate,
        status: "DRAFT",
      })
    )
  })

  it("rejects apply when the job is not open", async () => {
    vi.mocked(JobModel.findOne).mockReturnValue(mockQuery({ ...job, status: "paused" }) as never)

    await expect(
      applyToCareerJob("acme", IDS.job, {
        name: "Alex Candidate",
        email: "alex@example.com",
        consent: true,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MESSAGES.JOB_NOT_ACCEPTING,
    } satisfies Partial<AppError>)

    expect(ApplicationModel.create).not.toHaveBeenCalled()
  })
})
