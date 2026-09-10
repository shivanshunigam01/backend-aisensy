import { MESSAGES } from "../constants/messages.js"
import {
  APPLICATION_STAGE_LABELS,
  APPLICATION_STAGES,
  KANBAN_STAGES,
  type ApplicationStage,
} from "../constants/recruitment.js"
import { ApplicationModel } from "../models/application.model.js"
import { CandidateModel } from "../models/candidate.model.js"
import { generateCandidateNumber, splitCandidateName } from "../utils/candidate-number.js"
import { DepartmentModel } from "../models/department.model.js"
import { JobModel } from "../models/job.model.js"
import type { AuthContext } from "../types/auth.js"
import { recordActivity } from "../utils/activity.js"
import { AppError } from "../utils/app-error.js"
import {
  dateKeyFromDate,
  dateKeyInTimeZone,
  formatShortDate,
  initialsFromName,
  utcDateFromKey,
} from "../utils/dates.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { applySearch, escapeRegex, mongoSort, resolvedSearch } from "../utils/search.js"
import type {
  ApplicationListQueryInput,
  BoardQueryInput,
  CandidateListQueryInput,
  CreateApplicationInput,
  CreateCandidateInput,
  CreateJobInput,
  JobListQueryInput,
  UpdateApplicationInput,
  UpdateCandidateInput,
  UpdateJobInput,
} from "../validators/recruitment.validators.js"

const DEFAULT_TIMEZONE = "Asia/Kolkata"
const JOB_POPULATE = { path: "departmentId", select: "name code" }

function asId(value: unknown) {
  if (!value) return ""
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id: unknown })._id)
  }
  return String(value)
}

function isoOf(value: unknown) {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string" && value) return new Date(value).toISOString()
  return ""
}

function dateKeyOf(value: unknown) {
  if (value instanceof Date) return dateKeyFromDate(value)
  if (typeof value === "string" && value) return dateKeyFromDate(new Date(value))
  return ""
}

function skillsOf(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 20)
}

function todayKey() {
  return dateKeyInTimeZone(new Date(), DEFAULT_TIMEZONE)
}

function toPublicJob(doc: Record<string, unknown>) {
  const department =
    doc.departmentId && typeof doc.departmentId === "object" && "name" in doc.departmentId
      ? (doc.departmentId as { _id: unknown; name: string; code?: string })
      : null

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    mandateId: asId(doc.mandateId) || null,
    title: String(doc.title ?? ""),
    departmentId: department ? String(department._id) : asId(doc.departmentId) || null,
    department: department
      ? { id: String(department._id), name: department.name, code: department.code ?? "" }
      : null,
    departmentName: String(doc.departmentName ?? department?.name ?? ""),
    location: String(doc.location ?? ""),
    employmentType: String(doc.employmentType ?? "full_time"),
    description: String(doc.description ?? ""),
    workMode: String(doc.workMode ?? ""),
    skills: skillsOf(doc.skills),
    experienceMinimum: Number(doc.experienceMinimum ?? 0),
    experienceMaximum: Number(doc.experienceMaximum ?? 0),
    vacancies: Number(doc.vacancies ?? 1),
    status: String(doc.status ?? "open"),
    createdAt: isoOf(doc.createdAt),
    updatedAt: isoOf(doc.updatedAt),
  }
}

function toPublicCandidate(doc: Record<string, unknown>) {
  const name = String(doc.name ?? "")
  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    name,
    initials: initialsFromName(name),
    email: String(doc.email ?? ""),
    phone: String(doc.phone ?? ""),
    resume: String(doc.resume ?? ""),
    resumeFileName: String(doc.resumeFileName ?? ""),
    experience: Number(doc.experience ?? 0),
    skills: skillsOf(doc.skills),
    createdAt: isoOf(doc.createdAt),
    updatedAt: isoOf(doc.updatedAt),
  }
}

function toPublicApplication(doc: Record<string, unknown>) {
  const candidate =
    doc.candidateId && typeof doc.candidateId === "object" && "name" in doc.candidateId
      ? toPublicCandidate(doc.candidateId as Record<string, unknown>)
      : null
  const job =
    doc.jobId && typeof doc.jobId === "object" && "title" in doc.jobId
      ? toPublicJob(doc.jobId as Record<string, unknown>)
      : null
  const appliedDate = dateKeyOf(doc.appliedDate)

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    jobId: job?.id ?? asId(doc.jobId),
    candidateId: candidate?.id ?? asId(doc.candidateId),
    job,
    candidate,
    stage: String(doc.stage ?? "applied") as ApplicationStage,
    stageLabel: APPLICATION_STAGE_LABELS[(doc.stage as ApplicationStage) ?? "applied"],
    appliedDate,
    appliedLabel: appliedDate ? formatShortDate(appliedDate) : "",
    notes: String(doc.notes ?? ""),
    sortOrder: Number(doc.sortOrder ?? 0),
    createdAt: isoOf(doc.createdAt),
    updatedAt: isoOf(doc.updatedAt),
  }
}

async function assertDepartment(organizationId: string, departmentId?: string) {
  if (!departmentId) return null
  parseObjectId(departmentId, "Invalid department")
  const department = await DepartmentModel.findOne({
    _id: departmentId,
    organizationId,
  }).select("_id")
  if (!department) {
    throw AppError.badRequest("Department not found")
  }
  return departmentId
}

async function requireJob(organizationId: string, jobId: string) {
  parseObjectId(jobId, "Invalid job")
  const job = await JobModel.findOne({ _id: jobId, organizationId }).populate(JOB_POPULATE)
  if (!job) {
    throw AppError.notFound(MESSAGES.JOB_NOT_FOUND)
  }
  return job
}

export async function listJobs(auth: AuthContext, query: JobListQueryInput) {
  const filter: Record<string, unknown> = { organizationId: auth.organizationId }
  if (query.status) filter.status = query.status
  if (query.departmentId) {
    parseObjectId(query.departmentId, "Invalid department")
    filter.departmentId = query.departmentId
  }
  applySearch(filter, ["title", "location"], resolvedSearch(query))

  const [items, total] = await Promise.all([
    JobModel.find(filter)
      .populate(JOB_POPULATE)
      .sort(mongoSort(query, { createdAt: -1 }))
      .skip(paginationSkip(query))
      .limit(query.limit)
      .lean(),
    JobModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicJob(item as Record<string, unknown>)),
    ...paginationMeta(total, query),
  }
}

export async function getJob(auth: AuthContext, id: string) {
  const job = await requireJob(auth.organizationId, id)
  return toPublicJob(job.toObject() as Record<string, unknown>)
}

export async function createJob(auth: AuthContext, input: CreateJobInput) {
  const departmentId = await assertDepartment(auth.organizationId, input.departmentId)
  const created = await JobModel.create({
    organizationId: auth.organizationId,
    title: input.title,
    departmentId: departmentId ?? null,
    location: input.location ?? "",
    employmentType: input.employmentType,
    description: input.description ?? "",
    status: input.status ?? "open",
  })
  await created.populate(JOB_POPULATE)
  await recordActivity(auth.organizationId, {
    title: "Job opening posted",
    detail: created.title,
    tone: "success",
  })
  return toPublicJob(created.toObject() as Record<string, unknown>)
}

export async function updateJob(auth: AuthContext, id: string, input: UpdateJobInput) {
  const job = await requireJob(auth.organizationId, id)
  if (input.title !== undefined) job.title = input.title
  if (input.location !== undefined) job.location = input.location
  if (input.employmentType !== undefined) job.employmentType = input.employmentType
  if (input.description !== undefined) job.description = input.description
  if (input.status !== undefined) job.status = input.status
  if (input.departmentId !== undefined) {
    job.set("departmentId", (await assertDepartment(auth.organizationId, input.departmentId)) ?? null)
  }
  await job.save()
  await job.populate(JOB_POPULATE)
  return toPublicJob(job.toObject() as Record<string, unknown>)
}

export async function deleteJob(auth: AuthContext, id: string) {
  const job = await requireJob(auth.organizationId, id)
  await ApplicationModel.deleteMany({ organizationId: auth.organizationId, jobId: job._id })
  await job.deleteOne()
}

export async function listCandidates(auth: AuthContext, query: CandidateListQueryInput) {
  const filter: Record<string, unknown> = { organizationId: auth.organizationId }
  applySearch(filter, ["name", "email", "skills"], resolvedSearch(query))

  const [items, total] = await Promise.all([
    CandidateModel.find(filter)
      .sort(mongoSort(query, { createdAt: -1 }))
      .skip(paginationSkip(query))
      .limit(query.limit)
      .lean(),
    CandidateModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicCandidate(item as Record<string, unknown>)),
    ...paginationMeta(total, query),
  }
}

export async function getCandidate(auth: AuthContext, id: string) {
  parseObjectId(id)
  const candidate = await CandidateModel.findOne({
    _id: id,
    organizationId: auth.organizationId,
  }).lean()
  if (!candidate) {
    throw AppError.notFound(MESSAGES.CANDIDATE_NOT_FOUND)
  }
  return toPublicCandidate(candidate as Record<string, unknown>)
}

export async function createCandidate(auth: AuthContext, input: CreateCandidateInput) {
  try {
    const names = splitCandidateName(input.name)
    const created = await CandidateModel.create({
      organizationId: auth.organizationId,
      candidateNumber: await generateCandidateNumber(auth.organizationId),
      firstName: names.firstName,
      lastName: names.lastName,
      name: input.name,
      email: input.email,
      phone: input.phone ?? "",
      resume: input.resume ?? "",
      resumeUrl: input.resume ?? "",
      experience: input.experience ?? 0,
      totalExperience: input.experience ?? 0,
      skills: input.skills ?? [],
      status: "NEW",
      source: "DIRECT",
    })
    return toPublicCandidate(created.toObject() as Record<string, unknown>)
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw AppError.conflict(MESSAGES.CANDIDATE_EMAIL_IN_USE)
    }
    throw error
  }
}

export async function updateCandidate(auth: AuthContext, id: string, input: UpdateCandidateInput) {
  parseObjectId(id)
  const candidate = await CandidateModel.findOne({
    _id: id,
    organizationId: auth.organizationId,
  })
  if (!candidate) {
    throw AppError.notFound(MESSAGES.CANDIDATE_NOT_FOUND)
  }

  if (input.name !== undefined) candidate.name = input.name
  if (input.email !== undefined) candidate.email = input.email
  if (input.phone !== undefined) candidate.phone = input.phone
  if (input.experience !== undefined) candidate.experience = input.experience
  if (input.skills !== undefined) candidate.skills = input.skills
  if (input.resume !== undefined) candidate.resume = input.resume

  try {
    await candidate.save()
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw AppError.conflict(MESSAGES.CANDIDATE_EMAIL_IN_USE)
    }
    throw error
  }

  return toPublicCandidate(candidate.toObject() as Record<string, unknown>)
}

async function upsertCandidate(
  auth: AuthContext,
  input: {
    candidateId?: string
    name?: string
    email?: string
    phone?: string
    resume?: string
    experience?: number
    skills?: string[]
  }
) {
  if (input.candidateId) {
    parseObjectId(input.candidateId, "Invalid candidate")
    const existing = await CandidateModel.findOne({
      _id: input.candidateId,
      organizationId: auth.organizationId,
    })
    if (!existing) {
      throw AppError.notFound(MESSAGES.CANDIDATE_NOT_FOUND)
    }
    return existing
  }

  if (!input.email || !input.name) {
    throw AppError.badRequest("Provide a candidate or a name and email")
  }

  const found = await CandidateModel.findOne({
    organizationId: auth.organizationId,
    email: input.email.toLowerCase(),
  })

  if (found) {
    if (input.name) found.name = input.name
    if (input.phone) found.phone = input.phone
    if (input.experience !== undefined) found.experience = input.experience
    if (input.skills?.length) found.skills = input.skills
    if (input.resume) found.resume = input.resume
    await found.save()
    return found
  }

  const names = splitCandidateName(input.name)
  return CandidateModel.create({
    organizationId: auth.organizationId,
    candidateNumber: await generateCandidateNumber(auth.organizationId),
    firstName: names.firstName,
    lastName: names.lastName,
    name: input.name,
    email: input.email,
    phone: input.phone ?? "",
    resume: input.resume ?? "",
    resumeUrl: input.resume ?? "",
    experience: input.experience ?? 0,
    totalExperience: input.experience ?? 0,
    skills: input.skills ?? [],
    status: "NEW",
    source: "DIRECT",
  })
}

const APPLICATION_POPULATE = [
  { path: "candidateId" },
  { path: "jobId", populate: JOB_POPULATE },
]

export async function listApplications(auth: AuthContext, query: ApplicationListQueryInput) {
  const filter: Record<string, unknown> = { organizationId: auth.organizationId }
  if (query.jobId) {
    parseObjectId(query.jobId, "Invalid job")
    filter.jobId = query.jobId
  }
  if (query.candidateId) {
    parseObjectId(query.candidateId, "Invalid candidate")
    filter.candidateId = query.candidateId
  }
  if (query.stage) filter.stage = query.stage

  const search = resolvedSearch(query)
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i")
    const people = await CandidateModel.find({
      organizationId: auth.organizationId,
      $or: [{ name: regex }, { email: regex }, { skills: regex }],
    }).select("_id")
    const jobs = await JobModel.find({
      organizationId: auth.organizationId,
      title: regex,
    }).select("_id")
    filter.$or = [
      { candidateId: { $in: people.map((item) => item._id) } },
      { jobId: { $in: jobs.map((item) => item._id) } },
    ]
  }

  const [items, total] = await Promise.all([
    ApplicationModel.find(filter)
      .populate(APPLICATION_POPULATE)
      .sort(mongoSort(query, { sortOrder: 1, appliedDate: -1 }))
      .skip(paginationSkip(query))
      .limit(query.limit)
      .lean(),
    ApplicationModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicApplication(item as Record<string, unknown>)),
    ...paginationMeta(total, query),
  }
}

export async function getApplication(auth: AuthContext, id: string) {
  parseObjectId(id)
  const application = await ApplicationModel.findOne({
    _id: id,
    organizationId: auth.organizationId,
  })
    .populate(APPLICATION_POPULATE)
    .lean()
  if (!application) {
    throw AppError.notFound(MESSAGES.APPLICATION_NOT_FOUND)
  }
  return toPublicApplication(application as Record<string, unknown>)
}

export async function createApplication(auth: AuthContext, input: CreateApplicationInput) {
  const job = await requireJob(auth.organizationId, input.jobId)
  if (job.status === "closed") {
    throw AppError.badRequest(MESSAGES.JOB_CLOSED)
  }

  const candidate = await upsertCandidate(auth, input)
  const appliedDate = input.appliedDate ? utcDateFromKey(input.appliedDate) : utcDateFromKey(todayKey())
  const last = await ApplicationModel.findOne({
    organizationId: auth.organizationId,
    jobId: job._id,
    stage: "applied",
  })
    .sort({ sortOrder: -1 })
    .select("sortOrder")
    .lean()

  try {
    const created = await ApplicationModel.create({
      organizationId: auth.organizationId,
      jobId: job._id,
      candidateId: candidate._id,
      stage: "applied",
      appliedDate,
      notes: input.notes ?? "",
      sortOrder: (last?.sortOrder ?? 0) + 1,
    })
    await created.populate(APPLICATION_POPULATE)
    await recordActivity(auth.organizationId, {
      title: "Candidate applied",
      detail: `${candidate.name} · ${job.title}`,
      tone: "brand",
    })
    return toPublicApplication(created.toObject() as Record<string, unknown>)
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw AppError.conflict(MESSAGES.APPLICATION_EXISTS)
    }
    throw error
  }
}

export async function updateApplication(
  auth: AuthContext,
  id: string,
  input: UpdateApplicationInput
) {
  parseObjectId(id)
  const application = await ApplicationModel.findOne({
    _id: id,
    organizationId: auth.organizationId,
  })
  if (!application) {
    throw AppError.notFound(MESSAGES.APPLICATION_NOT_FOUND)
  }

  const previousStage = application.stage
  if (input.stage !== undefined) application.stage = input.stage
  if (input.notes !== undefined) application.notes = input.notes
  if (input.sortOrder !== undefined) application.sortOrder = input.sortOrder
  await application.save()
  await application.populate(APPLICATION_POPULATE)

  const publicApplication = toPublicApplication(application.toObject() as Record<string, unknown>)
  if (input.stage && input.stage !== previousStage) {
    await recordActivity(auth.organizationId, {
      title: input.stage === "hired" ? "Candidate hired" : "Application moved",
      detail: `${publicApplication.candidate?.name ?? "Candidate"} → ${publicApplication.stageLabel}`,
      tone: input.stage === "hired" ? "success" : input.stage === "rejected" ? "warning" : "default",
    })
  }

  return publicApplication
}

export async function getBoard(auth: AuthContext, query: BoardQueryInput) {
  const jobs = await JobModel.find({ organizationId: auth.organizationId })
    .populate(JOB_POPULATE)
    .sort({ status: 1, createdAt: -1 })
    .limit(50)
    .lean()

  const applicationFilter: Record<string, unknown> = { organizationId: auth.organizationId }
  if (query.jobId) applicationFilter.jobId = query.jobId

  const search = resolvedSearch(query)
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i")
    const people = await CandidateModel.find({
      organizationId: auth.organizationId,
      $or: [{ name: regex }, { email: regex }, { skills: regex }],
    }).select("_id")
    applicationFilter.candidateId = { $in: people.map((item) => item._id) }
  }

  const applications = await ApplicationModel.find(applicationFilter)
    .populate(APPLICATION_POPULATE)
    .sort({ sortOrder: 1, appliedDate: -1 })
    .lean()

  const cards = applications.map((item) => toPublicApplication(item as Record<string, unknown>))
  const columns = KANBAN_STAGES.map((stage) => ({
    stage,
    label: APPLICATION_STAGE_LABELS[stage],
    items: cards.filter((card) => card.stage === stage),
  }))
  const rejected = cards.filter((card) => card.stage === "rejected")

  const openJobs = jobs.filter((job) => job.status === "open").length
  return {
    jobs: jobs.map((job) => toPublicJob(job as Record<string, unknown>)),
    columns,
    rejected,
    summary: {
      openJobs,
      inPipeline: cards.filter((card) => card.stage !== "hired" && card.stage !== "rejected").length,
      hired: cards.filter((card) => card.stage === "hired").length,
      rejected: rejected.length,
    },
    stages: APPLICATION_STAGES.map((stage) => ({
      stage,
      label: APPLICATION_STAGE_LABELS[stage],
    })),
  }
}
