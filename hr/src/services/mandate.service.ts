import { MESSAGES } from "../constants/messages.js"
import {
  DEFAULT_SALARY_CURRENCY,
  MANDATE_PRIORITY_LABELS,
  MANDATE_STATUS_LABELS,
  MANDATE_WORK_MODE_LABELS,
  type MandatePriority,
  type MandateStatus,
  type MandateWorkMode,
} from "../constants/mandates.js"
import { ClientAgreementModel } from "../models/client-agreement.model.js"
import { ClientModel } from "../models/client.model.js"
import { CandidateConsentModel } from "../models/candidate-consent.model.js"
import { CandidateEvaluationModel } from "../models/candidate-evaluation.model.js"
import { CandidateSubmissionModel } from "../models/candidate-submission.model.js"
import { JobApplicationModel } from "../models/job-application.model.js"
import { InterviewModel } from "../models/interview.model.js"
import { GuaranteeFollowUpModel } from "../models/guarantee-follow-up.model.js"
import { JoiningModel } from "../models/joining.model.js"
import { ReplacementCaseModel } from "../models/replacement-case.model.js"
import { OfferModel } from "../models/offer.model.js"
import { RecruitmentMandateModel } from "../models/recruitment-mandate.model.js"
import { UserModel } from "../models/user.model.js"
import type { AuthContext } from "../types/auth.js"
import { recordActivity } from "../utils/activity.js"
import { recordAudit } from "../utils/audit.js"
import { AppError } from "../utils/app-error.js"
import { utcDateFromKey } from "../utils/dates.js"
import { generateMandateNumber } from "../utils/mandate-number.js"
import { parseObjectId } from "../utils/object-id.js"
import {
  closeJobForMandate,
  findJobsByMandateIds,
  syncJobForMandate,
} from "../utils/publish-mandate-job.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { applySearch, mongoSort, resolvedSearch } from "../utils/search.js"
import type {
  CreateMandateInput,
  MandateListQueryInput,
  UpdateMandateInput,
} from "../validators/mandate.validators.js"

const MANDATE_POPULATE = [
  { path: "clientId", select: "companyName status industry" },
  { path: "agreementId", select: "agreementNumber status" },
  { path: "assignedRecruiters", select: "name email role" },
  { path: "createdBy", select: "name email role" },
] as const

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
  const iso = isoOf(value)
  return iso ? iso.slice(0, 10) : ""
}

function stringsOf(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

function toUserRef(value: unknown) {
  if (!value) return null
  if (typeof value === "object" && value !== null && "name" in value) {
    const user = value as { _id: unknown; name: string; email?: string; role?: string }
    return {
      id: String(user._id),
      name: user.name,
      email: user.email ?? "",
      role: user.role ?? "",
    }
  }
  return { id: String(value), name: "", email: "", role: "" }
}

function toAgreementRef(value: unknown) {
  if (!value) return null
  if (typeof value === "object" && value !== null && "agreementNumber" in value) {
    const agreement = value as { _id: unknown; agreementNumber: string; status?: string }
    return {
      id: String(agreement._id),
      agreementNumber: agreement.agreementNumber,
      status: agreement.status ?? "",
    }
  }
  return { id: String(value), agreementNumber: "", status: "" }
}

function toClientRef(value: unknown) {
  if (!value) return null
  if (typeof value === "object" && value !== null && "companyName" in value) {
    const client = value as { _id: unknown; companyName: string; status?: string; industry?: string }
    return {
      id: String(client._id),
      companyName: client.companyName,
      status: client.status ?? "",
      industry: client.industry ?? "",
    }
  }
  return { id: String(value), companyName: "", status: "", industry: "" }
}

function rangeOf(value: unknown, keys: { min?: number; max?: number; extra?: Record<string, unknown> }) {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    minimum: Number(source.minimum ?? keys.min ?? 0),
    maximum: Number(source.maximum ?? keys.max ?? 0),
    ...keys.extra,
  }
}

export function toPublicMandate(
  doc: Record<string, unknown>,
  job?: { id: string; status: string } | null
) {
  const status = String(doc.status ?? "DRAFT") as MandateStatus
  const priority = String(doc.priority ?? "MEDIUM") as MandatePriority
  const workMode = String(doc.workMode ?? "ONSITE") as MandateWorkMode
  const client = toClientRef(doc.clientId)
  const agreement = toAgreementRef(doc.agreementId)
  const salary = doc.salary && typeof doc.salary === "object" ? (doc.salary as Record<string, unknown>) : {}
  const jobId = job?.id ?? ""
  const jobStatus = job?.status ?? ""
  const skills = stringsOf(doc.skills)
  const mustHaveSkillsRaw = stringsOf(doc.mustHaveSkills)
  const mustHaveSkills = mustHaveSkillsRaw.length ? mustHaveSkillsRaw : skills
  const preferredSkills = stringsOf(doc.preferredSkills)

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    clientId: client?.id ?? asId(doc.clientId),
    client,
    agreementId: agreement?.id ?? asId(doc.agreementId),
    agreement,
    mandateNumber: String(doc.mandateNumber ?? ""),
    position: String(doc.position ?? ""),
    department: String(doc.department ?? ""),
    employmentType: String(doc.employmentType ?? "full_time"),
    vacancies: Number(doc.vacancies ?? 1),
    location: String(doc.location ?? ""),
    workMode,
    workModeLabel: MANDATE_WORK_MODE_LABELS[workMode] ?? workMode,
    reportingTo: String(doc.reportingTo ?? ""),
    experience: rangeOf(doc.experience, {}),
    salary: {
      ...rangeOf(doc.salary, {}),
      currency: String(salary.currency ?? DEFAULT_SALARY_CURRENCY),
      fixedPercent:
        salary.fixedPercent === null || salary.fixedPercent === undefined
          ? null
          : Number(salary.fixedPercent),
      variablePercent:
        salary.variablePercent === null || salary.variablePercent === undefined
          ? null
          : Number(salary.variablePercent),
    },
    qualifications: stringsOf(doc.qualifications),
    skills,
    mustHaveSkills,
    preferredSkills,
    responsibilities: stringsOf(doc.responsibilities),
    criticalRequirements: stringsOf(doc.criticalRequirements),
    interviewProcess: stringsOf(doc.interviewProcess),
    industryPreference: String(doc.industryPreference ?? ""),
    teamSize: String(doc.teamSize ?? ""),
    acceptedNoticePeriod: String(doc.acceptedNoticePeriod ?? ""),
    travelRequirement: String(doc.travelRequirement ?? ""),
    workingDaysHours: String(doc.workingDaysHours ?? ""),
    targetJoiningDate: dateKeyOf(doc.targetJoiningDate),
    paymentTermsDays: Number(doc.paymentTermsDays ?? 15),
    exclusivity: Boolean(doc.exclusivity),
    specialInstructions: String(doc.specialInstructions ?? ""),
    assignedRecruiters: Array.isArray(doc.assignedRecruiters)
      ? doc.assignedRecruiters.map(toUserRef).filter((user): user is NonNullable<typeof user> => user !== null)
      : [],
    recruitmentFee: Number(doc.recruitmentFee ?? 0),
    feeType: String(doc.feeType ?? "PERCENTAGE"),
    replacementPeriodDays: Number(doc.replacementPeriodDays ?? 90),
    priority,
    priorityLabel: MANDATE_PRIORITY_LABELS[priority] ?? priority,
    status,
    statusLabel: MANDATE_STATUS_LABELS[status] ?? status,
    jobId,
    jobStatus,
    published: Boolean(doc.isPublic) && status === "OPEN",
    isPublic: Boolean(doc.isPublic),
    publishedAt: isoOf(doc.publishedAt) || null,
    createdBy: toUserRef(doc.createdBy),
    createdAt: isoOf(doc.createdAt),
    updatedAt: isoOf(doc.updatedAt),
  }
}

async function withPublishedJob(doc: Record<string, unknown>) {
  const jobs = await findJobsByMandateIds(asId(doc.organizationId), [doc._id ?? doc.id])
  return toPublicMandate(doc, jobs.get(asId(doc._id ?? doc.id)) ?? null)
}

function isDuplicateKey(error: unknown, field: string) {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 11000) {
    return false
  }

  const key =
    "keyPattern" in error && error.keyPattern && typeof error.keyPattern === "object"
      ? error.keyPattern
      : null

  return Boolean(key && field in key)
}

async function requireMandate(organizationId: string, id: string) {
  parseObjectId(id)
  const mandate = await RecruitmentMandateModel.findOne({ _id: id, organizationId }).populate([
    ...MANDATE_POPULATE,
  ])

  if (!mandate) {
    throw AppError.notFound(MESSAGES.MANDATE_NOT_FOUND)
  }

  return mandate
}

async function assertClient(organizationId: string, clientId: string) {
  parseObjectId(clientId, "Invalid client")
  const client = await ClientModel.findOne({ _id: clientId, organizationId }).select(
    "_id companyName status industry"
  )

  if (!client) {
    throw AppError.badRequest(MESSAGES.CLIENT_NOT_IN_ORGANIZATION)
  }

  return client
}

async function assertAgreement(organizationId: string, agreementId: string, clientId: string) {
  parseObjectId(agreementId, "Invalid agreement")
  const agreement = await ClientAgreementModel.findOne({
    _id: agreementId,
    organizationId,
  }).select("_id clientId agreementNumber status commercialTerms replacementPeriodDays")

  if (!agreement) {
    throw AppError.badRequest(MESSAGES.AGREEMENT_NOT_IN_ORGANIZATION)
  }

  if (String(agreement.clientId) !== String(clientId)) {
    throw AppError.badRequest(MESSAGES.AGREEMENT_CLIENT_MISMATCH)
  }

  return agreement
}

async function assertRecruiters(organizationId: string, recruiterIds?: string[]) {
  if (!recruiterIds?.length) {
    return []
  }

  const uniqueIds = [...new Set(recruiterIds)]
  uniqueIds.forEach((id) => parseObjectId(id, "Invalid recruiter"))

  const users = await UserModel.find({
    _id: { $in: uniqueIds },
    organizationId,
    isActive: true,
  }).select("_id")

  if (users.length !== uniqueIds.length) {
    throw AppError.badRequest(MESSAGES.INVALID_RECRUITERS)
  }

  return uniqueIds
}

export async function listMandates(auth: AuthContext, query: MandateListQueryInput) {
  const filter: Record<string, unknown> = { organizationId: auth.organizationId }

  if (query.status) filter.status = query.status
  if (query.priority) filter.priority = query.priority
  if (query.clientId) {
    parseObjectId(query.clientId, "Invalid client")
    filter.clientId = query.clientId
  }
  if (query.agreementId) {
    parseObjectId(query.agreementId, "Invalid agreement")
    filter.agreementId = query.agreementId
  }
  if (query.recruiterId) {
    parseObjectId(query.recruiterId, "Invalid recruiter")
    filter.assignedRecruiters = query.recruiterId
  }
  applySearch(filter, ["position", "mandateNumber", "location"], resolvedSearch(query))

  const [items, total] = await Promise.all([
    RecruitmentMandateModel.find(filter)
      .populate([...MANDATE_POPULATE])
      .sort(mongoSort(query, { createdAt: -1 }))
      .skip(paginationSkip(query))
      .limit(query.limit)
      .lean(),
    RecruitmentMandateModel.countDocuments(filter),
  ])

  const jobs = await findJobsByMandateIds(
    auth.organizationId,
    items.map((item) => (item as { _id: unknown })._id)
  )

  return {
    items: items.map((item) => {
      const record = item as Record<string, unknown>
      return toPublicMandate(record, jobs.get(asId(record._id)) ?? null)
    }),
    ...paginationMeta(total, query),
  }
}

export async function getMandate(auth: AuthContext, id: string) {
  const mandate = await requireMandate(auth.organizationId, id)
  return withPublishedJob(mandate.toObject() as Record<string, unknown>)
}

async function createMandateDocument(auth: AuthContext, input: CreateMandateInput) {
  const client = await assertClient(auth.organizationId, input.clientId)
  const agreement = await assertAgreement(auth.organizationId, input.agreementId, String(client._id))
  const assignedRecruiters = await assertRecruiters(auth.organizationId, input.assignedRecruiters)
  const mandateNumber = await generateMandateNumber(auth.organizationId)

  return RecruitmentMandateModel.create({
    organizationId: auth.organizationId,
    clientId: client._id,
    agreementId: agreement._id,
    mandateNumber,
    createdBy: auth.userId,
    assignedRecruiters,
    position: input.position,
    department: input.department ?? "",
    employmentType: input.employmentType ?? "full_time",
    vacancies: input.vacancies ?? 1,
    location: input.location ?? "",
    workMode: input.workMode ?? "ONSITE",
    reportingTo: input.reportingTo ?? "",
    experience: {
      minimum: input.experience?.minimum ?? 0,
      maximum: input.experience?.maximum ?? input.experience?.minimum ?? 0,
    },
    salary: {
      minimum: input.salary?.minimum ?? 0,
      maximum: input.salary?.maximum ?? input.salary?.minimum ?? 0,
      currency: (input.salary?.currency ?? DEFAULT_SALARY_CURRENCY).toUpperCase(),
      fixedPercent: input.salary?.fixedPercent ?? null,
      variablePercent: input.salary?.variablePercent ?? null,
    },
    qualifications: input.qualifications ?? [],
    skills: input.skills ?? [],
    mustHaveSkills: input.mustHaveSkills ?? input.skills ?? [],
    preferredSkills: input.preferredSkills ?? [],
    responsibilities: input.responsibilities ?? [],
    criticalRequirements: input.criticalRequirements ?? [],
    interviewProcess: input.interviewProcess ?? [],
    industryPreference: input.industryPreference ?? "",
    teamSize: input.teamSize ?? "",
    acceptedNoticePeriod: input.acceptedNoticePeriod ?? "",
    travelRequirement: input.travelRequirement ?? "",
    workingDaysHours: input.workingDaysHours ?? "",
    targetJoiningDate: input.targetJoiningDate ? utcDateFromKey(input.targetJoiningDate) : null,
    paymentTermsDays:
      input.paymentTermsDays ?? agreement.commercialTerms?.paymentTermsDays ?? 15,
    exclusivity: Boolean(input.exclusivity),
    specialInstructions: input.specialInstructions ?? "",
    recruitmentFee: input.recruitmentFee ?? agreement.commercialTerms?.recruitmentFee ?? 0,
    feeType: input.feeType ?? agreement.commercialTerms?.feeType ?? "PERCENTAGE",
    replacementPeriodDays:
      input.replacementPeriodDays ?? agreement.replacementPeriodDays ?? 90,
    priority: input.priority ?? "MEDIUM",
    status: input.status ?? "DRAFT",
    isPublic: Boolean(input.isPublic),
    publishedAt: input.isPublic && (input.status ?? "DRAFT") === "OPEN" ? new Date() : null,
  })
}

export async function createMandate(auth: AuthContext, input: CreateMandateInput) {
  let created
  try {
    created = await createMandateDocument(auth, input)
  } catch (error) {
    if (!isDuplicateKey(error, "mandateNumber")) {
      throw error
    }
    created = await createMandateDocument(auth, input)
  }

  await created.populate([...MANDATE_POPULATE])
  await syncJobForMandate(created)
  await recordActivity(auth.organizationId, {
    title: `Mandate ${created.mandateNumber} opened`,
    detail: created.position,
    tone: "success",
  })

  const publicMandate = await withPublishedJob(created.toObject() as Record<string, unknown>)
  if (publicMandate.status === "APPROVED" || publicMandate.status === "OPEN") {
    await recordAudit(auth, {
      module: "MANDATES",
      action: "APPROVED",
      recordId: publicMandate.id,
      newData: {
        status: publicMandate.status,
        mandateNumber: publicMandate.mandateNumber,
        position: publicMandate.position,
      },
    })
  }

  return publicMandate
}

export async function updateMandate(auth: AuthContext, id: string, input: UpdateMandateInput) {
  const mandate = await requireMandate(auth.organizationId, id)
  const previousStatus = String(mandate.status)

  if (input.clientId !== undefined) {
    const client = await assertClient(auth.organizationId, input.clientId)
    mandate.set("clientId", client._id)
  }

  const nextClientId = input.clientId ?? asId(mandate.clientId)
  if (input.agreementId !== undefined) {
    const agreement = await assertAgreement(auth.organizationId, input.agreementId, nextClientId)
    mandate.set("agreementId", agreement._id)
  } else if (input.clientId !== undefined && mandate.agreementId) {
    await assertAgreement(auth.organizationId, asId(mandate.agreementId), nextClientId)
  }

  if (input.assignedRecruiters !== undefined) {
    mandate.set("assignedRecruiters", await assertRecruiters(auth.organizationId, input.assignedRecruiters))
  }

  if (input.position !== undefined) mandate.position = input.position
  if (input.department !== undefined) mandate.department = input.department ?? ""
  if (input.employmentType !== undefined) mandate.employmentType = input.employmentType
  if (input.vacancies !== undefined) mandate.vacancies = input.vacancies
  if (input.location !== undefined) mandate.location = input.location ?? ""
  if (input.workMode !== undefined) mandate.workMode = input.workMode
  if (input.reportingTo !== undefined) mandate.reportingTo = input.reportingTo ?? ""
  if (input.experience !== undefined) {
    mandate.set("experience", {
      minimum: input.experience.minimum ?? 0,
      maximum: input.experience.maximum ?? input.experience.minimum ?? 0,
    })
  }
  if (input.salary !== undefined) {
    mandate.set("salary", {
      minimum: input.salary.minimum ?? 0,
      maximum: input.salary.maximum ?? input.salary.minimum ?? 0,
      currency: (input.salary.currency ?? DEFAULT_SALARY_CURRENCY).toUpperCase(),
      fixedPercent: input.salary.fixedPercent ?? null,
      variablePercent: input.salary.variablePercent ?? null,
    })
  }
  if (input.qualifications !== undefined) mandate.set("qualifications", input.qualifications)
  if (input.skills !== undefined) mandate.set("skills", input.skills)
  if (input.mustHaveSkills !== undefined) mandate.set("mustHaveSkills", input.mustHaveSkills)
  if (input.preferredSkills !== undefined) mandate.set("preferredSkills", input.preferredSkills)
  if (input.responsibilities !== undefined) mandate.set("responsibilities", input.responsibilities)
  if (input.criticalRequirements !== undefined) {
    mandate.set("criticalRequirements", input.criticalRequirements)
  }
  if (input.interviewProcess !== undefined) mandate.set("interviewProcess", input.interviewProcess)
  if (input.industryPreference !== undefined) {
    mandate.industryPreference = input.industryPreference ?? ""
  }
  if (input.teamSize !== undefined) mandate.teamSize = input.teamSize ?? ""
  if (input.acceptedNoticePeriod !== undefined) {
    mandate.acceptedNoticePeriod = input.acceptedNoticePeriod ?? ""
  }
  if (input.travelRequirement !== undefined) {
    mandate.travelRequirement = input.travelRequirement ?? ""
  }
  if (input.workingDaysHours !== undefined) {
    mandate.workingDaysHours = input.workingDaysHours ?? ""
  }
  if (input.targetJoiningDate !== undefined) {
    mandate.targetJoiningDate = input.targetJoiningDate
      ? utcDateFromKey(input.targetJoiningDate)
      : null
  }
  if (input.paymentTermsDays !== undefined) mandate.paymentTermsDays = input.paymentTermsDays
  if (input.exclusivity !== undefined) mandate.exclusivity = input.exclusivity
  if (input.specialInstructions !== undefined) {
    mandate.specialInstructions = input.specialInstructions ?? ""
  }
  if (input.recruitmentFee !== undefined) mandate.recruitmentFee = input.recruitmentFee
  if (input.feeType !== undefined) mandate.feeType = input.feeType
  if (input.replacementPeriodDays !== undefined) {
    mandate.replacementPeriodDays = input.replacementPeriodDays
  }
  if (input.priority !== undefined) mandate.priority = input.priority
  if (input.status !== undefined) mandate.status = input.status
  if (input.isPublic !== undefined) mandate.isPublic = input.isPublic

  const nextStatus = String(mandate.status)
  if (mandate.isPublic && nextStatus === "OPEN" && !mandate.publishedAt) {
    mandate.publishedAt = new Date()
  }

  await mandate.save()
  await mandate.populate([...MANDATE_POPULATE])
  await syncJobForMandate(mandate)

  const publicMandate = await withPublishedJob(mandate.toObject() as Record<string, unknown>)
  if (input.status !== undefined && previousStatus !== publicMandate.status) {
    const approvedNow =
      (publicMandate.status === "APPROVED" || publicMandate.status === "OPEN") &&
      previousStatus !== "APPROVED" &&
      previousStatus !== "OPEN"
    await recordAudit(auth, {
      module: "MANDATES",
      action: approvedNow ? "APPROVED" : "STATUS_CHANGED",
      recordId: publicMandate.id,
      previousData: { status: previousStatus },
      newData: {
        status: publicMandate.status,
        mandateNumber: publicMandate.mandateNumber,
        position: publicMandate.position,
      },
    })
  }

  return publicMandate
}

export async function deleteMandate(auth: AuthContext, id: string) {
  parseObjectId(id)
  const hasConsents = await CandidateConsentModel.exists({
    organizationId: auth.organizationId,
    mandateId: id,
  })
  if (hasConsents) {
    throw AppError.conflict(MESSAGES.MANDATE_HAS_CONSENTS)
  }

  const hasApplications = await JobApplicationModel.exists({
    organizationId: auth.organizationId,
    mandateId: id,
  })
  if (hasApplications) {
    throw AppError.conflict(MESSAGES.MANDATE_HAS_APPLICATIONS)
  }

  const hasEvaluations = await CandidateEvaluationModel.exists({
    organizationId: auth.organizationId,
    mandateId: id,
  })
  if (hasEvaluations) {
    throw AppError.conflict(MESSAGES.MANDATE_HAS_EVALUATIONS)
  }

  const hasSubmissions = await CandidateSubmissionModel.exists({
    organizationId: auth.organizationId,
    mandateId: id,
  })
  if (hasSubmissions) {
    throw AppError.conflict(MESSAGES.MANDATE_HAS_SUBMISSIONS)
  }

  const hasInterviews = await InterviewModel.exists({
    organizationId: auth.organizationId,
    mandateId: id,
  })
  if (hasInterviews) {
    throw AppError.conflict(MESSAGES.MANDATE_HAS_INTERVIEWS)
  }

  const hasOffers = await OfferModel.exists({
    organizationId: auth.organizationId,
    mandateId: id,
  })
  if (hasOffers) {
    throw AppError.conflict(MESSAGES.MANDATE_HAS_OFFERS)
  }

  const hasJoinings = await JoiningModel.exists({
    organizationId: auth.organizationId,
    mandateId: id,
  })
  if (hasJoinings) {
    throw AppError.conflict(MESSAGES.MANDATE_HAS_JOININGS)
  }

  const hasGuarantees = await GuaranteeFollowUpModel.exists({
    organizationId: auth.organizationId,
    mandateId: id,
  })
  if (hasGuarantees) {
    throw AppError.conflict(MESSAGES.MANDATE_HAS_GUARANTEES)
  }

  const hasReplacements = await ReplacementCaseModel.exists({
    organizationId: auth.organizationId,
    mandateId: id,
  })
  if (hasReplacements) {
    throw AppError.conflict(MESSAGES.MANDATE_HAS_REPLACEMENTS)
  }

  const deleted = await RecruitmentMandateModel.findOneAndDelete({
    _id: id,
    organizationId: auth.organizationId,
  })

  if (!deleted) {
    throw AppError.notFound(MESSAGES.MANDATE_NOT_FOUND)
  }

  await closeJobForMandate(auth.organizationId, id)
}
