import { MESSAGES } from "../constants/messages.js"
import { ApplicationModel } from "../models/application.model.js"
import { CandidateModel } from "../models/candidate.model.js"
import { CandidateSubmissionModel } from "../models/candidate-submission.model.js"
import { JobModel } from "../models/job.model.js"
import { OrganizationModel } from "../models/organization.model.js"
import { RecruitmentMandateModel } from "../models/recruitment-mandate.model.js"
import { recordActivity } from "../utils/activity.js"
import { AppError } from "../utils/app-error.js"
import { generateCandidateNumber, splitCandidateName } from "../utils/candidate-number.js"
import { dateKeyFromDate, dateKeyInTimeZone, utcDateFromKey } from "../utils/dates.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationSkip } from "../utils/pagination.js"
import { applySearch, mongoSort, resolvedSearch } from "../utils/search.js"
import type { CareersListQueryInput, PublicApplyInput } from "../validators/career.validators.js"

const DEFAULT_TIMEZONE = "Asia/Kolkata"

function asId(value: unknown) {
  if (!value) return ""
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id: unknown })._id)
  }
  return String(value)
}

function skillsOf(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 20)
}

function toPublicOrg(doc: Record<string, unknown>) {
  return {
    name: String(doc.name ?? ""),
    slug: String(doc.slug ?? ""),
    logo: String(doc.logo ?? ""),
    industry: String(doc.industry ?? ""),
  }
}

export function toCareerJob(doc: Record<string, unknown>) {
  return {
    id: String(doc._id ?? doc.id),
    title: String(doc.title ?? ""),
    department: String(doc.departmentName ?? ""),
    location: String(doc.location ?? ""),
    employmentType: String(doc.employmentType ?? "full_time"),
    description: String(doc.description ?? ""),
    workMode: String(doc.workMode ?? ""),
    skills: skillsOf(doc.skills),
    experienceMinimum: Number(doc.experienceMinimum ?? 0),
    experienceMaximum: Number(doc.experienceMaximum ?? 0),
    vacancies: Number(doc.vacancies ?? 1),
    postedAt: doc.createdAt instanceof Date ? dateKeyFromDate(doc.createdAt) : "",
  }
}

async function requireOrganization(slug: string) {
  const organization = await OrganizationModel.findOne({ slug: slug.toLowerCase().trim() }).lean()
  if (!organization) {
    throw AppError.notFound(MESSAGES.CAREERS_ORG_NOT_FOUND)
  }
  return organization
}

async function requireOpenJob(organizationId: string, jobId: string) {
  parseObjectId(jobId, "Invalid job")
  const job = await JobModel.findOne({ _id: jobId, organizationId }).lean()
  if (!job) {
    throw AppError.notFound(MESSAGES.JOB_NOT_FOUND)
  }
  if (job.status !== "open") {
    throw AppError.badRequest(MESSAGES.JOB_NOT_ACCEPTING)
  }
  return job
}

async function upsertWebsiteCandidate(
  organizationId: string,
  input: PublicApplyInput
) {
  const email = input.email.toLowerCase()
  const found = await CandidateModel.findOne({ organizationId, email })
  const names = splitCandidateName(input.name)

  if (found) {
    found.name = input.name
    found.firstName = names.firstName
    found.lastName = names.lastName
    if (input.phone) found.phone = input.phone
    if (input.experience !== undefined) {
      found.experience = input.experience
      found.totalExperience = input.experience
    }
    if (input.skills?.length) found.skills = input.skills
    if (input.resume) {
      found.resume = input.resume
      found.resumeUrl = input.resume
    }
    found.consent = { given: true, date: new Date(), method: "FORM" }
    if (found.source === "DIRECT") found.source = "WEBSITE"
    await found.save()
    return found
  }

  return CandidateModel.create({
    organizationId,
    candidateNumber: await generateCandidateNumber(organizationId),
    firstName: names.firstName,
    lastName: names.lastName,
    name: input.name,
    email,
    phone: input.phone ?? "",
    resume: input.resume ?? "",
    resumeUrl: input.resume ?? "",
    experience: input.experience ?? 0,
    totalExperience: input.experience ?? 0,
    skills: input.skills ?? [],
    status: "NEW",
    source: "WEBSITE",
    consent: { given: true, date: new Date(), method: "FORM" },
  })
}

async function createDraftSubmission(input: {
  organizationId: string
  candidateId: string
  jobMandateId: string
  applicationId: string
  notes?: string
}) {
  const mandate = await RecruitmentMandateModel.findOne({
    _id: input.jobMandateId,
    organizationId: input.organizationId,
    status: "OPEN",
  }).select("_id clientId createdBy assignedRecruiters")

  if (!mandate) return

  const submittedBy = mandate.createdBy ?? mandate.assignedRecruiters?.[0]
  if (!submittedBy) return

  try {
    await CandidateSubmissionModel.create({
      organizationId: input.organizationId,
      candidateId: input.candidateId,
      clientId: mandate.clientId,
      mandateId: mandate._id,
      applicationId: input.applicationId,
      submittedBy,
      status: "DRAFT",
      remarks: input.notes || "Applied via career page",
    })
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return
    }
    throw error
  }
}

export async function listCareerJobs(orgSlug: string, query: CareersListQueryInput) {
  const organization = await requireOrganization(orgSlug)
  const filter: Record<string, unknown> = {
    organizationId: organization._id,
    status: "open",
  }

  applySearch(filter, ["title", "location", "departmentName", "skills"], resolvedSearch(query))

  const pagination = { page: query.page ?? 1, limit: query.limit ?? 50 }
  const jobs = await JobModel.find(filter)
    .sort(mongoSort(query, { createdAt: -1 }))
    .skip(paginationSkip(pagination))
    .limit(pagination.limit)
    .lean()

  return {
    organization: toPublicOrg(organization as Record<string, unknown>),
    jobs: jobs.map((job) => toCareerJob(job as Record<string, unknown>)),
  }
}

export async function getCareerJob(orgSlug: string, jobId: string) {
  const organization = await requireOrganization(orgSlug)
  const job = await requireOpenJob(String(organization._id), jobId)
  return {
    organization: toPublicOrg(organization as Record<string, unknown>),
    job: toCareerJob(job as Record<string, unknown>),
  }
}

export async function applyToCareerJob(orgSlug: string, jobId: string, input: PublicApplyInput) {
  const organization = await requireOrganization(orgSlug)
  const organizationId = String(organization._id)
  const job = await requireOpenJob(organizationId, jobId)
  const candidate = await upsertWebsiteCandidate(organizationId, input)
  const today = dateKeyInTimeZone(new Date(), DEFAULT_TIMEZONE)
  const last = await ApplicationModel.findOne({
    organizationId,
    jobId: job._id,
    stage: "applied",
  })
    .sort({ sortOrder: -1 })
    .select("sortOrder")
    .lean()

  try {
    const created = await ApplicationModel.create({
      organizationId,
      jobId: job._id,
      candidateId: candidate._id,
      stage: "applied",
      appliedDate: utcDateFromKey(today),
      notes: input.notes ?? "",
      sortOrder: (last?.sortOrder ?? 0) + 1,
    })

    if (job.mandateId) {
      await createDraftSubmission({
        organizationId,
        candidateId: String(candidate._id),
        jobMandateId: String(job.mandateId),
        applicationId: String(created._id),
        notes: input.notes,
      })
    }

    await recordActivity(organizationId, {
      title: "Career page application",
      detail: `${candidate.name} · ${job.title}`,
      tone: "brand",
    })

    return { applied: true }
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw AppError.conflict(MESSAGES.APPLICATION_EXISTS)
    }
    throw error
  }
}
