import { beforeEach, describe, expect, it, vi } from "vitest"

import { IDS, mockQuery } from "../__tests__/helpers.js"
import { MESSAGES } from "../constants/messages.js"
import { AppError } from "../utils/app-error.js"

vi.mock("../models/recruitment-mandate.model.js", () => ({
  RecruitmentMandateModel: {
    find: vi.fn(),
    findOne: vi.fn(),
    exists: vi.fn(),
    countDocuments: vi.fn(),
  },
}))

vi.mock("../models/job.model.js", () => ({
  JobModel: {
    find: vi.fn(),
    findOne: vi.fn(),
  },
}))

vi.mock("../models/organization.model.js", () => ({
  OrganizationModel: {
    find: vi.fn(),
    findOne: vi.fn(),
  },
}))

vi.mock("../models/application.model.js", () => ({
  ApplicationModel: {
    exists: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock("../models/candidate.model.js", () => ({
  CandidateModel: { findOne: vi.fn(), create: vi.fn() },
}))

vi.mock("../models/job-application.model.js", () => ({
  JobApplicationModel: { exists: vi.fn(), create: vi.fn(), findOne: vi.fn() },
}))

vi.mock("../models/candidate-consent.model.js", () => ({
  CandidateConsentModel: { create: vi.fn() },
}))

vi.mock("../models/candidate-submission.model.js", () => ({
  CandidateSubmissionModel: { create: vi.fn() },
}))

vi.mock("../utils/candidate-number.js", () => ({
  generateCandidateNumber: vi.fn().mockResolvedValue("CAND-2026-0001"),
  splitCandidateName: (name: string) => {
    const [firstName, ...rest] = name.split(" ")
    return { firstName, lastName: rest.join(" ") }
  },
}))

vi.mock("../utils/application-number.js", () => ({
  generateApplicationNumber: vi.fn().mockResolvedValue("APP-2026-0001"),
}))

vi.mock("../utils/cloudinary.js", () => ({
  isCloudinaryConfigured: vi.fn().mockReturnValue(false),
  uploadCareerResume: vi.fn(),
}))

vi.mock("../utils/local-files.js", () => ({
  saveLocalCareerResume: vi.fn(),
}))

vi.mock("../utils/activity.js", () => ({
  recordActivity: vi.fn().mockResolvedValue(undefined),
}))

const { RecruitmentMandateModel } = await import("../models/recruitment-mandate.model.js")
const { JobModel } = await import("../models/job.model.js")
const { OrganizationModel } = await import("../models/organization.model.js")
const { ApplicationModel } = await import("../models/application.model.js")
const { CandidateModel } = await import("../models/candidate.model.js")
const { JobApplicationModel } = await import("../models/job-application.model.js")
const { CandidateConsentModel } = await import("../models/candidate-consent.model.js")
const { saveLocalCareerResume } = await import("../utils/local-files.js")
const { applyToPublicCareer, listPublicCareers } = await import("./public-career.service.js")

const mandate = {
  _id: IDS.mandate,
  organizationId: IDS.org,
  clientId: IDS.client,
  createdBy: IDS.hrUser,
  position: "Product Engineer",
  department: "Engineering",
  location: "Pune",
  workMode: "HYBRID",
  employmentType: "full_time",
  vacancies: 1,
  experience: { minimum: 2, maximum: 5 },
  salary: { minimum: 1200000, maximum: 1800000, currency: "INR" },
  skills: ["TypeScript"],
  qualifications: [],
  responsibilities: ["Build the product"],
  criticalRequirements: [],
  interviewProcess: [],
  status: "OPEN",
  isPublic: true,
  publishedAt: new Date("2026-08-30T10:00:00.000Z"),
  createdAt: new Date("2026-08-30T10:00:00.000Z"),
  toObject() {
    return this
  },
}

describe("public-career.service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("lists OPEN public mandates and staff-posted open jobs", async () => {
    vi.mocked(RecruitmentMandateModel.find).mockReturnValue(mockQuery([mandate]) as never)
    vi.mocked(JobModel.find).mockReturnValue(
      mockQuery([
        {
          _id: IDS.job,
          organizationId: IDS.org,
          title: "test",
          location: "AHMEDABAD",
          employmentType: "full_time",
          description: "test",
          status: "open",
          mandateId: null,
          createdAt: new Date("2026-08-30T10:32:07.142Z"),
        },
      ]) as never
    )
    vi.mocked(OrganizationModel.find).mockReturnValue(mockQuery([{ _id: IDS.org, name: "PeopleFlow" }]) as never)

    const result = await listPublicCareers({ page: 1, limit: 20 })

    expect(RecruitmentMandateModel.find).toHaveBeenCalledWith({ status: "OPEN", isPublic: true })
    expect(JobModel.find).toHaveBeenCalledWith({
      status: "open",
      $or: [{ mandateId: null }, { mandateId: { $exists: false } }],
    })
    expect(result.items.map((item) => item.position)).toEqual(["test", "Product Engineer"])
    expect(result.items[1]).not.toHaveProperty("recruitmentFee")
    expect(result.items[0]?.location).toBe("AHMEDABAD")
    expect(result.items[0]?.companyName).toBe("PeopleFlow")
  })

  it("creates a candidate, application, and consent on apply", async () => {
    vi.mocked(RecruitmentMandateModel.findOne).mockReturnValue(mockQuery(mandate) as never)
    vi.mocked(CandidateModel.findOne).mockResolvedValue(null)
    vi.mocked(CandidateModel.create).mockResolvedValue({
      _id: IDS.candidate,
      name: "Alex Candidate",
    } as never)
    vi.mocked(JobApplicationModel.exists).mockResolvedValue(null)
    vi.mocked(JobApplicationModel.create).mockResolvedValue({
      _id: "64a00000000000000000001b",
      applicationNumber: "APP-2026-0001",
    } as never)
    vi.mocked(CandidateConsentModel.create).mockResolvedValue({} as never)

    const result = await applyToPublicCareer(IDS.mandate, {
      firstName: "Alex",
      lastName: "Candidate",
      email: "alex@example.com",
      phone: "9876543210",
      totalExperience: 4,
      relevantExperience: 3,
      currentCTC: 0,
      expectedCTC: 0,
      consent: true,
    })

    expect(result.applicationNumber).toBe("APP-2026-0001")
    expect(CandidateModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        email: "alex@example.com",
        source: "WEBSITE",
        status: "SCREENING",
      })
    )
    expect(JobApplicationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mandateId: IDS.mandate,
        source: "CAREER_PAGE",
        status: "APPLIED",
      })
    )
  })

  it("rejects a duplicate application for the same mandate", async () => {
    vi.mocked(RecruitmentMandateModel.findOne).mockReturnValue(mockQuery(mandate) as never)
    vi.mocked(CandidateModel.findOne).mockResolvedValue({
      _id: IDS.candidate,
      name: "Alex Candidate",
      email: "alex@example.com",
      save: vi.fn().mockResolvedValue(undefined),
    } as never)
    vi.mocked(JobApplicationModel.exists).mockResolvedValue({ _id: "x" } as never)

    await expect(
      applyToPublicCareer(IDS.mandate, {
        firstName: "Alex",
        lastName: "Candidate",
        email: "alex@example.com",
        phone: "9876543210",
        totalExperience: 4,
        relevantExperience: 3,
        currentCTC: 0,
        expectedCTC: 0,
        consent: true,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: MESSAGES.JOB_APPLICATION_ALREADY_APPLIED,
    } satisfies Partial<AppError>)
  })

  it("creates a hiring-board application for a staff-posted job", async () => {
    vi.mocked(RecruitmentMandateModel.findOne).mockReturnValue(mockQuery(null) as never)
    vi.mocked(JobModel.findOne).mockReturnValue(
      mockQuery({
        _id: IDS.job,
        organizationId: IDS.org,
        title: "test",
        status: "open",
        mandateId: null,
      }) as never
    )
    vi.mocked(OrganizationModel.find).mockReturnValue(mockQuery([{ _id: IDS.org, name: "PeopleFlow" }]) as never)
    vi.mocked(CandidateModel.findOne).mockResolvedValue(null)
    vi.mocked(CandidateModel.create).mockResolvedValue({
      _id: IDS.candidate,
      name: "Alex Candidate",
    } as never)
    vi.mocked(ApplicationModel.exists).mockResolvedValue(null)
    vi.mocked(ApplicationModel.findOne).mockReturnValue(mockQuery(null) as never)
    vi.mocked(ApplicationModel.create).mockResolvedValue({
      _id: IDS.job,
    } as never)

    const result = await applyToPublicCareer(IDS.job, {
      firstName: "Alex",
      lastName: "Candidate",
      email: "alex@example.com",
      phone: "9876543210",
      totalExperience: 4,
      relevantExperience: 3,
      currentCTC: 0,
      expectedCTC: 0,
      consent: true,
    })

    expect(result.applicationId).toBe(IDS.job)
    expect(ApplicationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: IDS.job,
        stage: "applied",
      })
    )
  })

  it("stores a resume locally when Cloudinary is not configured", async () => {
    vi.mocked(RecruitmentMandateModel.findOne).mockReturnValue(mockQuery(mandate) as never)
    vi.mocked(CandidateModel.findOne).mockResolvedValue(null)
    vi.mocked(CandidateModel.create).mockResolvedValue({
      _id: IDS.candidate,
      name: "Alex Candidate",
    } as never)
    vi.mocked(JobApplicationModel.exists).mockResolvedValue(null)
    vi.mocked(JobApplicationModel.create).mockResolvedValue({
      _id: "64a00000000000000000001b",
      applicationNumber: "APP-2026-0001",
    } as never)
    vi.mocked(CandidateConsentModel.create).mockResolvedValue({} as never)
    vi.mocked(saveLocalCareerResume).mockResolvedValue({
      publicId: "local:careers/2c1a7f0a-4b21-4d8e-9c11-0f3a2b1c4d5e.pdf",
      fileUrl: "http://localhost:4000/api/v1/public/files/2c1a7f0a-4b21-4d8e-9c11-0f3a2b1c4d5e.pdf",
      fileName: "resume.pdf",
    })

    await applyToPublicCareer(
      IDS.mandate,
      {
        firstName: "Alex",
        lastName: "Candidate",
        email: "alex@example.com",
        phone: "9876543210",
        totalExperience: 4,
        relevantExperience: 3,
        currentCTC: 0,
        expectedCTC: 0,
        consent: true,
      },
      {
        buffer: Buffer.from("%PDF-1.7"),
        originalname: "resume.pdf",
        mimetype: "application/pdf",
      } as Express.Multer.File
    )

    expect(saveLocalCareerResume).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: IDS.org,
        filename: "resume.pdf",
        mimeType: "application/pdf",
      })
    )
    expect(CandidateModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        resumeUrl: "http://localhost:4000/api/v1/public/files/2c1a7f0a-4b21-4d8e-9c11-0f3a2b1c4d5e.pdf",
        resumeFileName: "resume.pdf",
      })
    )
  })

  it("hides unpublished mandates", async () => {
    vi.mocked(RecruitmentMandateModel.findOne).mockReturnValue(
      mockQuery({ ...mandate, isPublic: false }) as never
    )

    await expect(
      applyToPublicCareer(IDS.mandate, {
        firstName: "Alex",
        lastName: "Candidate",
        email: "alex@example.com",
        phone: "9876543210",
        totalExperience: 0,
        relevantExperience: 0,
        currentCTC: 0,
        expectedCTC: 0,
        consent: true,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      message: MESSAGES.CAREER_JOB_NOT_PUBLIC,
    } satisfies Partial<AppError>)
  })
})
