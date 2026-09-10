import {
  MANDATE_WORK_MODES,
  MANDATE_WORK_MODE_LABELS,
  type MandateWorkMode,
} from "../constants/mandates.js"
import { MESSAGES } from "../constants/messages.js"
import { ApplicationModel } from "../models/application.model.js"
import { CandidateConsentModel } from "../models/candidate-consent.model.js"
import { CandidateModel } from "../models/candidate.model.js"
import { CandidateSubmissionModel } from "../models/candidate-submission.model.js"
import { JobApplicationModel } from "../models/job-application.model.js"
import { JobModel } from "../models/job.model.js"
import { OrganizationModel } from "../models/organization.model.js"
import { RecruitmentMandateModel } from "../models/recruitment-mandate.model.js"
import { recordActivity } from "../utils/activity.js"
import { generateApplicationNumber } from "../utils/application-number.js"
import { AppError } from "../utils/app-error.js"
import { generateCandidateNumber } from "../utils/candidate-number.js"
import {
  isCloudinaryConfigured,
  uploadCareerResume,
} from "../utils/cloudinary.js"
import { saveLocalCareerResume } from "../utils/local-files.js"
import { dateKeyFromDate, dateKeyInTimeZone, formatShortDate, utcDateFromKey } from "../utils/dates.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { applySearch, escapeRegex } from "../utils/search.js"
import { triggerAiInterviewWorkflow } from "./ai-interview.service.js"
import { buildInterviewLink } from "./email.service.js"
import type { PublicCareerApplyInput, PublicCareerListQueryInput } from "../validators/public-career.validators.js"

const DEFAULT_TIMEZONE = "Asia/Kolkata"

const MANDATE_POPULATE = [{ path: "clientId", select: "companyName industry" }] as const

function asId(value: unknown) {
  if (!value) return ""
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id: unknown })._id)
  }
  return String(value)
}

function stringsOf(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

function rangeOf(value: unknown) {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    minimum: Number(source.minimum ?? 0),
    maximum: Number(source.maximum ?? 0),
  }
}

function postedLabel(value: unknown) {
  if (!(value instanceof Date)) return ""
  const key = dateKeyFromDate(value)
  return key ? formatShortDate(key) : ""
}

export function toPublicCareerJob(doc: Record<string, unknown>) {
  const workMode = String(doc.workMode ?? "ONSITE") as MandateWorkMode
  const client =
    doc.clientId && typeof doc.clientId === "object" && "companyName" in doc.clientId
      ? (doc.clientId as { companyName?: string })
      : null
  const salary = doc.salary && typeof doc.salary === "object" ? (doc.salary as Record<string, unknown>) : {}
  const postedAt = doc.publishedAt instanceof Date ? doc.publishedAt : doc.createdAt

  return {
    id: String(doc._id ?? doc.id),
    position: String(doc.position ?? ""),
    department: String(doc.department ?? ""),
    companyName: client?.companyName ?? "",
    location: String(doc.location ?? ""),
    workMode,
    workModeLabel: MANDATE_WORK_MODE_LABELS[workMode] ?? workMode,
    employmentType: String(doc.employmentType ?? "full_time"),
    vacancies: Number(doc.vacancies ?? 1),
    experience: rangeOf(doc.experience),
    salary: {
      ...rangeOf(doc.salary),
      currency: String(salary.currency ?? "INR"),
    },
    skills: stringsOf(doc.skills),
    qualifications: stringsOf(doc.qualifications),
    responsibilities: stringsOf(doc.responsibilities),
    criticalRequirements: stringsOf(doc.criticalRequirements),
    interviewProcess: stringsOf(doc.interviewProcess),
    postedAt: postedAt instanceof Date ? postedAt.toISOString() : "",
    postedLabel: postedLabel(postedAt),
  }
}

const PUBLIC_FILTER = { status: "OPEN" as const, isPublic: true }
const STAFF_JOB_POPULATE = [{ path: "departmentId", select: "name" }] as const

function staffJobFilter(query: PublicCareerListQueryInput) {
  const filter: Record<string, unknown> = {
    status: "open",
    $or: [{ mandateId: null }, { mandateId: { $exists: false } }],
  }
  if (query.location) {
    filter.location = new RegExp(escapeRegex(query.location), "i")
  }
  if (query.employmentType) filter.employmentType = query.employmentType
  if (query.workMode) filter.workMode = query.workMode
  applySearch(filter, ["title", "location", "departmentName", "skills", "description"], query.search)
  return filter
}

function isStaffJobOpen(doc: { status?: unknown; mandateId?: unknown }) {
  return doc.status === "open" && !doc.mandateId
}

function workModeOf(value: unknown) {
  const raw = String(value ?? "").trim().toUpperCase()
  const workMode = MANDATE_WORK_MODES.includes(raw as MandateWorkMode)
    ? (raw as MandateWorkMode)
    : "ONSITE"
  return {
    workMode,
    workModeLabel: MANDATE_WORK_MODE_LABELS[workMode],
  }
}

function departmentOfJob(doc: Record<string, unknown>) {
  if (doc.departmentId && typeof doc.departmentId === "object" && "name" in doc.departmentId) {
    return String((doc.departmentId as { name?: string }).name ?? "")
  }
  return String(doc.departmentName ?? "")
}

function postedSortValue(item: { postedAt: string }) {
  const time = Date.parse(item.postedAt)
  return Number.isFinite(time) ? time : 0
}

export function toPublicCareerFromJob(doc: Record<string, unknown>, companyName: string) {
  const { workMode, workModeLabel } = workModeOf(doc.workMode)
  const description = String(doc.description ?? "").trim()
  const postedAt = doc.createdAt instanceof Date ? doc.createdAt : null

  return {
    id: String(doc._id ?? doc.id),
    position: String(doc.title ?? ""),
    department: departmentOfJob(doc),
    companyName,
    location: String(doc.location ?? ""),
    workMode,
    workModeLabel,
    employmentType: String(doc.employmentType ?? "full_time"),
    vacancies: Number(doc.vacancies ?? 1) || 1,
    experience: {
      minimum: Number(doc.experienceMinimum ?? 0),
      maximum: Number(doc.experienceMaximum ?? 0),
    },
    salary: {
      minimum: 0,
      maximum: 0,
      currency: "INR",
    },
    skills: stringsOf(doc.skills),
    qualifications: [] as string[],
    responsibilities: description
      ? description
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
      : [],
    criticalRequirements: [] as string[],
    interviewProcess: [] as string[],
    postedAt: postedAt ? postedAt.toISOString() : "",
    postedLabel: postedLabel(postedAt),
  }
}

async function organizationNames(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return new Map<string, string>()

  const organizations = await OrganizationModel.find({ _id: { $in: unique } })
    .select("name")
    .lean()

  return new Map(organizations.map((org) => [String(org._id), String(org.name ?? "")]))
}

type PublicListing =
  | { kind: "mandate"; doc: Record<string, unknown> }
  | { kind: "job"; doc: Record<string, unknown>; companyName: string }

async function findPublicListing(id: string): Promise<PublicListing> {
  parseObjectId(id, "Invalid job")

  const mandate = await RecruitmentMandateModel.findOne({ _id: id })
    .populate([...MANDATE_POPULATE])
    .lean()

  if (mandate) {
    if (mandate.status === "OPEN" && mandate.isPublic) {
      return { kind: "mandate", doc: mandate as Record<string, unknown> }
    }
    throw AppError.badRequest(MESSAGES.CAREER_JOB_NOT_PUBLIC)
  }

  const job = await JobModel.findOne({ _id: id })
    .populate([...STAFF_JOB_POPULATE])
    .lean()

  if (job) {
    if (!isStaffJobOpen(job)) {
      throw AppError.badRequest(MESSAGES.CAREER_JOB_NOT_PUBLIC)
    }
    const names = await organizationNames([asId(job.organizationId)])
    return {
      kind: "job",
      doc: job as Record<string, unknown>,
      companyName: names.get(asId(job.organizationId)) ?? "",
    }
  }

  throw AppError.notFound(MESSAGES.CAREER_JOB_NOT_FOUND)
}

async function findExistingCandidate(organizationId: string, email: string, phone: string) {
  const byEmail = await CandidateModel.findOne({ organizationId, email: email.toLowerCase() })
  if (byEmail) return byEmail

  if (!phone) return null
  return CandidateModel.findOne({ organizationId, phone })
}

async function upsertCareerCandidate(
  organizationId: string,
  input: PublicCareerApplyInput,
  resume?: { url: string; fileName: string; publicId: string }
) {
  const existing = await findExistingCandidate(organizationId, input.email, input.phone)
  const name = `${input.firstName} ${input.lastName}`.trim()
  const preferred = input.preferredLocations ?? []
  const skills = input.skills ?? []
  const qualifications = input.qualifications ?? []

  if (existing) {
    existing.firstName = input.firstName
    existing.lastName = input.lastName
    existing.name = name
    existing.email = input.email.toLowerCase()
    if (input.phone) existing.phone = input.phone
    if (input.currentCompany) existing.currentCompany = input.currentCompany
    if (input.currentDesignation) existing.currentDesignation = input.currentDesignation
    existing.totalExperience = input.totalExperience ?? existing.totalExperience
    existing.relevantExperience = input.relevantExperience ?? existing.relevantExperience
    existing.experience = input.totalExperience ?? existing.experience
    existing.currentCTC = input.currentCTC ?? existing.currentCTC
    existing.expectedCTC = input.expectedCTC ?? existing.expectedCTC
    if (input.noticePeriod) existing.noticePeriod = input.noticePeriod
    if (input.currentLocation) existing.currentLocation = input.currentLocation
    if (preferred.length) existing.preferredLocations = preferred
    if (skills.length) existing.skills = skills
    if (qualifications.length) existing.qualifications = qualifications
    if (input.linkedInUrl) existing.linkedInUrl = input.linkedInUrl
    if (resume?.url) {
      existing.resumeUrl = resume.url
      existing.resume = resume.url
      existing.resumeFileName = resume.fileName
      existing.resumePublicId = resume.publicId
    }
    existing.consent = { given: true, date: new Date(), method: "FORM" }
    if (existing.source === "DIRECT") existing.source = "WEBSITE"
    if (existing.status === "NEW") existing.status = "SCREENING"
    await existing.save()
    return existing
  }

  return CandidateModel.create({
    organizationId,
    candidateNumber: await generateCandidateNumber(organizationId),
    firstName: input.firstName,
    lastName: input.lastName,
    name,
    email: input.email.toLowerCase(),
    phone: input.phone,
    currentCompany: input.currentCompany ?? "",
    currentDesignation: input.currentDesignation ?? "",
    totalExperience: input.totalExperience ?? 0,
    relevantExperience: input.relevantExperience ?? 0,
    experience: input.totalExperience ?? 0,
    currentCTC: input.currentCTC ?? 0,
    expectedCTC: input.expectedCTC ?? 0,
    noticePeriod: input.noticePeriod ?? "",
    currentLocation: input.currentLocation ?? "",
    preferredLocations: preferred,
    skills,
    qualifications,
    linkedInUrl: input.linkedInUrl ?? "",
    resume: resume?.url ?? "",
    resumeUrl: resume?.url ?? "",
    resumeFileName: resume?.fileName ?? "",
    resumePublicId: resume?.publicId ?? "",
    status: "SCREENING",
    source: "WEBSITE",
    consent: { given: true, date: new Date(), method: "FORM" },
  })
}

async function ensureConsent(input: {
  organizationId: string
  candidateId: string
  mandateId: string
  createdBy: string
  resume?: { url: string; fileName: string }
}) {
  try {
    await CandidateConsentModel.create({
      organizationId: input.organizationId,
      candidateId: input.candidateId,
      mandateId: input.mandateId,
      consentGiven: true,
      consentDate: new Date(),
      consentMethod: "FORM",
      consentPurpose: "SOURCING",
      consentDocument: input.resume?.url
        ? { fileUrl: input.resume.url, fileName: input.resume.fileName }
        : null,
      createdBy: input.createdBy,
    })
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return
    }
    throw error
  }
}

async function ensureDraftSubmission(input: {
  organizationId: string
  candidateId: string
  mandateId: string
  clientId: string
  submittedBy: string
  applicationId: string
}) {
  try {
    await CandidateSubmissionModel.create({
      organizationId: input.organizationId,
      candidateId: input.candidateId,
      clientId: input.clientId,
      mandateId: input.mandateId,
      applicationId: input.applicationId,
      submittedBy: input.submittedBy,
      status: "DRAFT",
      remarks: "Applied via career page",
    })
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return
    }
    throw error
  }
}

async function storeCareerResume(
  organizationId: string,
  file: Express.Multer.File
) {
  const input = {
    buffer: file.buffer,
    organizationId,
    filename: file.originalname,
    mimeType: file.mimetype,
  }
  const uploaded = isCloudinaryConfigured()
    ? await uploadCareerResume(input)
    : await saveLocalCareerResume(input)
  return { url: uploaded.fileUrl, fileName: uploaded.fileName, publicId: uploaded.publicId }
}

async function uploadResumeIfPresent(
  organizationId: string,
  file?: Express.Multer.File
) {
  if (!file?.buffer) return undefined
  return storeCareerResume(organizationId, file)
}

export async function listPublicCareers(query: PublicCareerListQueryInput) {
  const filter: Record<string, unknown> = { ...PUBLIC_FILTER }
  if (query.location) {
    filter.location = new RegExp(escapeRegex(query.location), "i")
  }
  if (query.employmentType) filter.employmentType = query.employmentType
  if (query.workMode) filter.workMode = query.workMode
  applySearch(filter, ["position", "location", "department", "skills"], query.search)

  const [mandates, jobs] = await Promise.all([
    RecruitmentMandateModel.find(filter)
      .populate([...MANDATE_POPULATE])
      .lean(),
    JobModel.find(staffJobFilter(query)).populate([...STAFF_JOB_POPULATE]).lean(),
  ])

  const names = await organizationNames(jobs.map((job) => asId(job.organizationId)))
  const items = [
    ...mandates.map((item) => toPublicCareerJob(item as Record<string, unknown>)),
    ...jobs.map((item) =>
      toPublicCareerFromJob(item as Record<string, unknown>, names.get(asId(item.organizationId)) ?? "")
    ),
  ].sort((left, right) => postedSortValue(right) - postedSortValue(left))

  const skip = paginationSkip(query)
  return {
    items: items.slice(skip, skip + query.limit),
    ...paginationMeta(items.length, query),
  }
}

export async function getPublicCareer(listingId: string) {
  const listing = await findPublicListing(listingId)
  if (listing.kind === "job") {
    return { job: toPublicCareerFromJob(listing.doc, listing.companyName) }
  }
  return { job: toPublicCareerJob(listing.doc) }
}

async function applyToMandate(
  mandate: Record<string, unknown>,
  input: PublicCareerApplyInput,
  file?: Express.Multer.File
) {
  const organizationId = asId(mandate.organizationId)
  const mandateId = asId(mandate._id ?? mandate.id)
  const resume = await uploadResumeIfPresent(organizationId, file)
  const candidate = await upsertCareerCandidate(organizationId, input, resume)
  const candidateId = asId(candidate._id)
  const alreadyApplied = await JobApplicationModel.exists({
    organizationId,
    mandateId,
    candidateId,
  })
  if (alreadyApplied) {
    throw AppError.conflict(MESSAGES.JOB_APPLICATION_ALREADY_APPLIED)
  }

  try {
    const created = await JobApplicationModel.create({
      organizationId,
      mandateId,
      candidateId,
      applicationNumber: await generateApplicationNumber(organizationId),
      source: "CAREER_PAGE",
      status: "APPLIED",
      notes: input.notes ?? "",
      appliedAt: new Date(),
    })

    await ensureConsent({
      organizationId,
      candidateId,
      mandateId,
      createdBy: asId(mandate.createdBy),
      resume,
    })
    await ensureDraftSubmission({
      organizationId,
      candidateId,
      mandateId,
      clientId: asId(mandate.clientId),
      submittedBy: asId(mandate.createdBy),
      applicationId: String(created._id),
    })

    await recordActivity(organizationId, {
      title: "Career page application",
      detail: `${candidate.name} · ${mandate.position}`,
      tone: "brand",
    })

    let aiInterview: { interviewLink: string; expiresAt: string } | null = null
    try {
      const interview = await triggerAiInterviewWorkflow({
        organizationId,
        applicationId: String(created._id),
        applicationType: "JOB_APPLICATION",
        candidateId,
        jobId: mandateId,
        jobType: "MANDATE",
      })
      if (interview) {
        aiInterview = {
          interviewLink: buildInterviewLink(String(interview.uniqueToken)),
          expiresAt:
            interview.expiresAt instanceof Date
              ? interview.expiresAt.toISOString()
              : String(interview.expiresAt ?? ""),
        }
      }
    } catch (error) {
      console.error("[AI Interview] Failed to trigger workflow:", error)
    }

    return {
      applicationId: String(created._id),
      applicationNumber: created.applicationNumber,
      aiInterview,
    }
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw AppError.conflict(MESSAGES.JOB_APPLICATION_ALREADY_APPLIED)
    }
    throw error
  }
}

async function applyToStaffJob(
  job: Record<string, unknown>,
  input: PublicCareerApplyInput,
  file?: Express.Multer.File
) {
  const organizationId = asId(job.organizationId)
  const jobId = asId(job._id ?? job.id)
  const resume = await uploadResumeIfPresent(organizationId, file)
  const candidate = await upsertCareerCandidate(organizationId, input, resume)
  const candidateId = asId(candidate._id)
  const alreadyApplied = await ApplicationModel.exists({
    organizationId,
    jobId,
    candidateId,
  })
  if (alreadyApplied) {
    throw AppError.conflict(MESSAGES.JOB_APPLICATION_ALREADY_APPLIED)
  }

  const today = dateKeyInTimeZone(new Date(), DEFAULT_TIMEZONE)
  const last = await ApplicationModel.findOne({
    organizationId,
    jobId,
    stage: "applied",
  })
    .sort({ sortOrder: -1 })
    .select("sortOrder")
    .lean()

  try {
    const created = await ApplicationModel.create({
      organizationId,
      jobId,
      candidateId,
      stage: "applied",
      appliedDate: utcDateFromKey(today),
      notes: input.notes ?? "",
      sortOrder: (last?.sortOrder ?? 0) + 1,
    })

    await recordActivity(organizationId, {
      title: "Career page application",
      detail: `${candidate.name} · ${job.title}`,
      tone: "brand",
    })

    let aiInterview: { interviewLink: string; expiresAt: string } | null = null
    try {
      const interview = await triggerAiInterviewWorkflow({
        organizationId,
        applicationId: String(created._id),
        applicationType: "APPLICATION",
        candidateId,
        jobId,
        jobType: "JOB",
      })
      if (interview) {
        aiInterview = {
          interviewLink: buildInterviewLink(String(interview.uniqueToken)),
          expiresAt:
            interview.expiresAt instanceof Date
              ? interview.expiresAt.toISOString()
              : String(interview.expiresAt ?? ""),
        }
      }
    } catch (error) {
      console.error("[AI Interview] Failed to trigger workflow:", error)
    }

    return {
      applicationId: String(created._id),
      applicationNumber: await generateApplicationNumber(organizationId),
      aiInterview,
    }
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw AppError.conflict(MESSAGES.JOB_APPLICATION_ALREADY_APPLIED)
    }
    throw error
  }
}

export async function applyToPublicCareer(
  listingId: string,
  input: PublicCareerApplyInput,
  file?: Express.Multer.File
) {
  const listing = await findPublicListing(listingId)
  if (listing.kind === "job") {
    return applyToStaffJob(listing.doc, input, file)
  }
  return applyToMandate(listing.doc, input, file)
}
