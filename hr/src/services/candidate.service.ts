import {
  CANDIDATE_SOURCE_LABELS,
  CANDIDATE_STATUS_LABELS,
  type CandidateConsentMethod,
  type CandidateSource,
  type CandidateStatus,
} from "../constants/candidates.js"
import { MESSAGES } from "../constants/messages.js"
import { ApplicationModel } from "../models/application.model.js"
import { CandidateConsentModel } from "../models/candidate-consent.model.js"
import { CandidateEvaluationModel } from "../models/candidate-evaluation.model.js"
import { CandidateSubmissionModel } from "../models/candidate-submission.model.js"
import { InterviewModel } from "../models/interview.model.js"
import { OfferModel } from "../models/offer.model.js"
import { GuaranteeFollowUpModel } from "../models/guarantee-follow-up.model.js"
import { JoiningModel } from "../models/joining.model.js"
import { ReplacementCaseModel } from "../models/replacement-case.model.js"
import { PreJoiningFollowUpModel } from "../models/pre-joining-follow-up.model.js"
import { CandidateModel } from "../models/candidate.model.js"
import type { AuthContext } from "../types/auth.js"
import { recordActivity } from "../utils/activity.js"
import { recordAudit } from "../utils/audit.js"
import { AppError } from "../utils/app-error.js"
import { generateCandidateNumber } from "../utils/candidate-number.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { applySearch, escapeRegex, mongoSort, resolvedSearch } from "../utils/search.js"
import type {
  CandidateProfileListQueryInput,
  CreateCandidateProfileInput,
  UpdateCandidateProfileInput,
} from "../validators/candidate.validators.js"

const CREATED_BY_POPULATE = { path: "createdBy", select: "name email role" }

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

function stringsOf(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

function toCreatedBy(value: unknown) {
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

function normalizePhone(phone?: string) {
  return phone?.replace(/[\s-]/g, "").trim() ?? ""
}

export function toPublicCandidateProfile(doc: Record<string, unknown>) {
  const status = String(doc.status ?? "NEW") as CandidateStatus
  const source = String(doc.source ?? "DIRECT") as CandidateSource
  const consent =
    doc.consent && typeof doc.consent === "object" ? (doc.consent as Record<string, unknown>) : {}
  const firstName = String(doc.firstName ?? "")
  const lastName = String(doc.lastName ?? "")
  const name = String(doc.name ?? `${firstName} ${lastName}`.trim())
  const resumeUrl = String(doc.resumeUrl || doc.resume || "")

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    candidateNumber: String(doc.candidateNumber ?? ""),
    firstName,
    lastName,
    name,
    email: String(doc.email ?? ""),
    phone: String(doc.phone ?? ""),
    resumeUrl,
    currentCompany: String(doc.currentCompany ?? ""),
    currentDesignation: String(doc.currentDesignation ?? ""),
    totalExperience: Number(doc.totalExperience ?? doc.experience ?? 0),
    relevantExperience: Number(doc.relevantExperience ?? 0),
    currentCTC: Number(doc.currentCTC ?? 0),
    expectedCTC: Number(doc.expectedCTC ?? 0),
    noticePeriod: String(doc.noticePeriod ?? ""),
    currentLocation: String(doc.currentLocation ?? ""),
    preferredLocations: stringsOf(doc.preferredLocations),
    skills: stringsOf(doc.skills),
    qualifications: stringsOf(doc.qualifications),
    source,
    sourceLabel: CANDIDATE_SOURCE_LABELS[source] ?? source,
    consent: {
      given: Boolean(consent.given),
      date: consent.date ? isoOf(consent.date) : null,
      method: String(consent.method ?? ""),
    },
    status,
    statusLabel: CANDIDATE_STATUS_LABELS[status] ?? status,
    createdBy: toCreatedBy(doc.createdBy),
    createdAt: isoOf(doc.createdAt),
    updatedAt: isoOf(doc.updatedAt),
  }
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

function duplicateError(match: "email" | "phone", existing: { _id?: unknown; id?: string }) {
  const existingId = String(existing.id ?? existing._id ?? "")
  const message =
    match === "email" ? MESSAGES.CANDIDATE_EMAIL_IN_USE : MESSAGES.CANDIDATE_PHONE_IN_USE
  return AppError.conflict(message, { match, existingId })
}

async function findDuplicate(
  organizationId: string,
  input: { email?: string; phone?: string },
  excludeId?: string
) {
  if (input.email) {
    const byEmail = await CandidateModel.findOne({
      organizationId,
      email: input.email.toLowerCase(),
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).select("_id")
    if (byEmail) {
      throw duplicateError("email", byEmail)
    }
  }

  const phone = normalizePhone(input.phone)
  if (phone) {
    const byPhone = await CandidateModel.findOne({
      organizationId,
      phone,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).select("_id")
    if (byPhone) {
      throw duplicateError("phone", byPhone)
    }
  }
}

async function requireCandidate(organizationId: string, id: string) {
  parseObjectId(id)
  const candidate = await CandidateModel.findOne({ _id: id, organizationId }).populate(
    CREATED_BY_POPULATE
  )
  if (!candidate) {
    throw AppError.notFound(MESSAGES.CANDIDATE_NOT_FOUND)
  }
  return candidate
}

function consentFromInput(input?: CreateCandidateProfileInput["consent"]) {
  if (!input) {
    return { given: false, date: null as Date | null, method: "" as CandidateConsentMethod | "" }
  }
  const given = Boolean(input.given)
  return {
    given,
    date: input.date ? new Date(input.date) : given ? new Date() : null,
    method: (input.method ?? "") as CandidateConsentMethod | "",
  }
}

export async function listCandidates(auth: AuthContext, query: CandidateProfileListQueryInput) {
  const filter: Record<string, unknown> = { organizationId: auth.organizationId }

  if (query.status) {
    filter.status = query.status
  }

  if (query.source) {
    filter.source = query.source
  }

  if (query.email) {
    filter.email = new RegExp(escapeRegex(query.email), "i")
  }

  if (query.skills?.length) {
    filter.skills = {
      $all: query.skills.map((skill) => new RegExp(`^${escapeRegex(skill)}$`, "i")),
    }
  }

  applySearch(
    filter,
    ["firstName", "lastName", "name", "email", "phone", "candidateNumber", "currentCompany"],
    resolvedSearch(query)
  )

  const [items, total] = await Promise.all([
    CandidateModel.find(filter)
      .populate(CREATED_BY_POPULATE)
      .sort(mongoSort(query, { createdAt: -1 }))
      .skip(paginationSkip(query))
      .limit(query.limit)
      .lean(),
    CandidateModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicCandidateProfile(item as Record<string, unknown>)),
    ...paginationMeta(total, query),
  }
}

export async function getCandidate(auth: AuthContext, id: string) {
  const candidate = await requireCandidate(auth.organizationId, id)
  return toPublicCandidateProfile(candidate.toObject() as Record<string, unknown>)
}

async function createCandidateDocument(auth: AuthContext, input: CreateCandidateProfileInput) {
  const candidateNumber = await generateCandidateNumber(auth.organizationId)
  const phone = normalizePhone(input.phone)

  return CandidateModel.create({
    organizationId: auth.organizationId,
    candidateNumber,
    firstName: input.firstName,
    lastName: input.lastName,
    name: `${input.firstName} ${input.lastName}`.trim(),
    email: input.email.toLowerCase(),
    phone,
    resumeUrl: input.resumeUrl ?? "",
    resume: input.resumeUrl ?? "",
    currentCompany: input.currentCompany ?? "",
    currentDesignation: input.currentDesignation ?? "",
    totalExperience: input.totalExperience ?? 0,
    relevantExperience: input.relevantExperience ?? 0,
    experience: input.totalExperience ?? 0,
    currentCTC: input.currentCTC ?? 0,
    expectedCTC: input.expectedCTC ?? 0,
    noticePeriod: input.noticePeriod ?? "",
    currentLocation: input.currentLocation ?? "",
    preferredLocations: input.preferredLocations ?? [],
    skills: input.skills ?? [],
    qualifications: input.qualifications ?? [],
    source: input.source ?? "DIRECT",
    consent: consentFromInput(input.consent),
    status: input.status ?? "NEW",
    createdBy: auth.userId,
  })
}

export async function createCandidate(auth: AuthContext, input: CreateCandidateProfileInput) {
  await findDuplicate(auth.organizationId, input)

  let created: InstanceType<typeof CandidateModel>
  try {
    created = await createCandidateDocument(auth, input)
  } catch (error) {
    if (isDuplicateKey(error, "email")) {
      throw AppError.conflict(MESSAGES.CANDIDATE_EMAIL_IN_USE)
    }
    if (isDuplicateKey(error, "phone")) {
      throw AppError.conflict(MESSAGES.CANDIDATE_PHONE_IN_USE)
    }
    if (isDuplicateKey(error, "candidateNumber")) {
      created = await createCandidateDocument(auth, input)
    } else {
      throw error
    }
  }

  await created.populate(CREATED_BY_POPULATE)
  const publicCandidate = toPublicCandidateProfile(created.toObject() as Record<string, unknown>)
  await recordActivity(auth.organizationId, {
    title: `${created.name} added to the candidate pool`,
    detail: created.candidateNumber,
    tone: "success",
  })
  await recordAudit(auth, {
    module: "CANDIDATES",
    action: "CREATED",
    recordId: publicCandidate.id,
    newData: publicCandidate,
  })

  return publicCandidate
}

export async function updateCandidate(
  auth: AuthContext,
  id: string,
  input: UpdateCandidateProfileInput
) {
  const candidate = await requireCandidate(auth.organizationId, id)
  const previousStatus = String(candidate.status)

  await findDuplicate(
    auth.organizationId,
    {
      email: input.email,
      phone: input.phone,
    },
    candidate.id
  )

  if (input.firstName !== undefined) candidate.firstName = input.firstName
  if (input.lastName !== undefined) candidate.lastName = input.lastName
  if (input.email !== undefined) candidate.email = input.email.toLowerCase()
  if (input.phone !== undefined) candidate.phone = normalizePhone(input.phone)
  if (input.resumeUrl !== undefined) {
    candidate.resumeUrl = input.resumeUrl ?? ""
    candidate.resume = input.resumeUrl ?? ""
  }
  if (input.currentCompany !== undefined) candidate.currentCompany = input.currentCompany ?? ""
  if (input.currentDesignation !== undefined) {
    candidate.currentDesignation = input.currentDesignation ?? ""
  }
  if (input.totalExperience !== undefined) candidate.totalExperience = input.totalExperience
  if (input.relevantExperience !== undefined) candidate.relevantExperience = input.relevantExperience
  if (input.currentCTC !== undefined) candidate.currentCTC = input.currentCTC
  if (input.expectedCTC !== undefined) candidate.expectedCTC = input.expectedCTC
  if (input.noticePeriod !== undefined) candidate.noticePeriod = input.noticePeriod ?? ""
  if (input.currentLocation !== undefined) candidate.currentLocation = input.currentLocation ?? ""
  if (input.preferredLocations !== undefined) {
    candidate.set("preferredLocations", input.preferredLocations)
  }
  if (input.skills !== undefined) candidate.set("skills", input.skills)
  if (input.qualifications !== undefined) candidate.set("qualifications", input.qualifications)
  if (input.source !== undefined) candidate.source = input.source
  if (input.status !== undefined) candidate.status = input.status
  if (input.consent !== undefined) {
    candidate.set("consent", consentFromInput(input.consent))
  }

  try {
    await candidate.save()
  } catch (error) {
    if (isDuplicateKey(error, "email")) {
      throw AppError.conflict(MESSAGES.CANDIDATE_EMAIL_IN_USE)
    }
    if (isDuplicateKey(error, "phone")) {
      throw AppError.conflict(MESSAGES.CANDIDATE_PHONE_IN_USE)
    }
    throw error
  }

  await candidate.populate(CREATED_BY_POPULATE)
  const publicCandidate = toPublicCandidateProfile(candidate.toObject() as Record<string, unknown>)
  if (input.status !== undefined && previousStatus !== publicCandidate.status) {
    await recordAudit(auth, {
      module: "CANDIDATES",
      action: "STATUS_CHANGED",
      recordId: publicCandidate.id,
      previousData: { status: previousStatus },
      newData: {
        status: publicCandidate.status,
        name: publicCandidate.name,
        candidateNumber: publicCandidate.candidateNumber,
      },
    })
  }
  return publicCandidate
}

export async function deleteCandidate(auth: AuthContext, id: string) {
  parseObjectId(id)
  const linked = await ApplicationModel.exists({
    organizationId: auth.organizationId,
    candidateId: id,
  })
  if (linked) {
    throw AppError.conflict(MESSAGES.CANDIDATE_HAS_APPLICATIONS)
  }

  const hasConsents = await CandidateConsentModel.exists({
    organizationId: auth.organizationId,
    candidateId: id,
  })
  if (hasConsents) {
    throw AppError.conflict(MESSAGES.CANDIDATE_HAS_CONSENTS)
  }

  const hasEvaluations = await CandidateEvaluationModel.exists({
    organizationId: auth.organizationId,
    candidateId: id,
  })
  if (hasEvaluations) {
    throw AppError.conflict(MESSAGES.CANDIDATE_HAS_EVALUATIONS)
  }

  const hasSubmissions = await CandidateSubmissionModel.exists({
    organizationId: auth.organizationId,
    candidateId: id,
  })
  if (hasSubmissions) {
    throw AppError.conflict(MESSAGES.CANDIDATE_HAS_SUBMISSIONS)
  }

  const hasInterviews = await InterviewModel.exists({
    organizationId: auth.organizationId,
    candidateId: id,
  })
  if (hasInterviews) {
    throw AppError.conflict(MESSAGES.CANDIDATE_HAS_INTERVIEWS)
  }

  const hasOffers = await OfferModel.exists({
    organizationId: auth.organizationId,
    candidateId: id,
  })
  if (hasOffers) {
    throw AppError.conflict(MESSAGES.CANDIDATE_HAS_OFFERS)
  }

  const hasFollowUps = await PreJoiningFollowUpModel.exists({
    organizationId: auth.organizationId,
    candidateId: id,
  })
  if (hasFollowUps) {
    throw AppError.conflict(MESSAGES.CANDIDATE_HAS_FOLLOW_UPS)
  }

  const hasJoinings = await JoiningModel.exists({
    organizationId: auth.organizationId,
    candidateId: id,
  })
  if (hasJoinings) {
    throw AppError.conflict(MESSAGES.CANDIDATE_HAS_JOININGS)
  }

  const hasGuarantees = await GuaranteeFollowUpModel.exists({
    organizationId: auth.organizationId,
    candidateId: id,
  })
  if (hasGuarantees) {
    throw AppError.conflict(MESSAGES.CANDIDATE_HAS_GUARANTEES)
  }

  const hasReplacements = await ReplacementCaseModel.exists({
    organizationId: auth.organizationId,
    $or: [{ candidateId: id }, { replacementCandidateId: id }],
  })
  if (hasReplacements) {
    throw AppError.conflict(MESSAGES.CANDIDATE_HAS_REPLACEMENTS)
  }

  const deleted = await CandidateModel.findOneAndDelete({
    _id: id,
    organizationId: auth.organizationId,
  })
  if (!deleted) {
    throw AppError.notFound(MESSAGES.CANDIDATE_NOT_FOUND)
  }
}
