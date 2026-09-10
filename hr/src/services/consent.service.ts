import {
  CANDIDATE_CONSENT_METHOD_LABELS,
  CANDIDATE_CONSENT_PURPOSE_LABELS,
  type CandidateConsentMethod,
  type CandidateConsentPurpose,
} from "../constants/candidates.js"
import { MESSAGES } from "../constants/messages.js"
import { CandidateConsentModel } from "../models/candidate-consent.model.js"
import { CandidateModel } from "../models/candidate.model.js"
import { RecruitmentMandateModel } from "../models/recruitment-mandate.model.js"
import type { AuthContext } from "../types/auth.js"
import { recordActivity } from "../utils/activity.js"
import { recordAudit } from "../utils/audit.js"
import { AppError } from "../utils/app-error.js"
import { utcDateFromKey } from "../utils/dates.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { applySearch, mongoSort, resolvedSearch } from "../utils/search.js"
import type {
  ConsentListQueryInput,
  CreateConsentInput,
  UpdateConsentInput,
} from "../validators/consent.validators.js"

const CONSENT_POPULATE = [
  { path: "candidateId", select: "firstName lastName name email candidateNumber" },
  { path: "mandateId", select: "mandateNumber position status" },
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

function toCandidateRef(value: unknown) {
  if (!value) return null
  if (typeof value === "object" && value !== null && ("name" in value || "email" in value)) {
    const candidate = value as {
      _id: unknown
      name?: string
      firstName?: string
      lastName?: string
      email?: string
      candidateNumber?: string
    }
    const name =
      String(candidate.name ?? "").trim() ||
      `${candidate.firstName ?? ""} ${candidate.lastName ?? ""}`.trim()
    return {
      id: String(candidate._id),
      name,
      email: candidate.email ?? "",
      candidateNumber: candidate.candidateNumber ?? "",
    }
  }
  return { id: String(value), name: "", email: "", candidateNumber: "" }
}

function toMandateRef(value: unknown) {
  if (!value) return null
  if (typeof value === "object" && value !== null && "mandateNumber" in value) {
    const mandate = value as {
      _id: unknown
      mandateNumber: string
      position?: string
      status?: string
    }
    return {
      id: String(mandate._id),
      mandateNumber: mandate.mandateNumber,
      position: mandate.position ?? "",
      status: mandate.status ?? "",
    }
  }
  return { id: String(value), mandateNumber: "", position: "", status: "" }
}

function toDocument(value: unknown) {
  if (!value || typeof value !== "object") return null
  const doc = value as { fileUrl?: string; fileName?: string }
  const fileUrl = String(doc.fileUrl ?? "").trim()
  if (!fileUrl) return null
  return { fileUrl, fileName: String(doc.fileName ?? "") }
}

function documentOf(input: CreateConsentInput["consentDocument"]) {
  if (input === null) return null
  if (!input?.fileUrl) return null
  return { fileUrl: input.fileUrl, fileName: input.fileName ?? "" }
}

function dateFromKey(value?: string | null) {
  if (!value) return null
  return utcDateFromKey(value)
}

function derivedStatus(consentGiven: boolean, withdrawnAt: string, expiryDate: string) {
  if (withdrawnAt) return "WITHDRAWN" as const
  if (expiryDate && expiryDate < new Date().toISOString().slice(0, 10)) return "EXPIRED" as const
  if (consentGiven) return "ACTIVE" as const
  return "NOT_GIVEN" as const
}

export function toPublicConsent(doc: Record<string, unknown>) {
  const candidate = toCandidateRef(doc.candidateId)
  const mandate = toMandateRef(doc.mandateId)
  const method = (String(doc.consentMethod || "FORM") as CandidateConsentMethod) || "FORM"
  const purpose = (String(doc.consentPurpose || "SOURCING") as CandidateConsentPurpose) || "SOURCING"
  const consentGiven = Boolean(doc.consentGiven)
  const withdrawnAt = dateKeyOf(doc.withdrawnAt)
  const expiryDate = dateKeyOf(doc.expiryDate)
  const status = derivedStatus(consentGiven, withdrawnAt, expiryDate)

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    candidateId: candidate?.id ?? asId(doc.candidateId),
    candidate,
    mandateId: mandate?.id ?? asId(doc.mandateId),
    mandate,
    consentGiven,
    consentDate: dateKeyOf(doc.consentDate),
    consentMethod: method,
    consentMethodLabel: CANDIDATE_CONSENT_METHOD_LABELS[method] ?? method,
    consentPurpose: purpose,
    consentPurposeLabel: CANDIDATE_CONSENT_PURPOSE_LABELS[purpose] ?? purpose,
    consentDocument: toDocument(doc.consentDocument),
    expiryDate,
    withdrawnAt,
    status,
    createdBy: toUserRef(doc.createdBy),
    createdAt: isoOf(doc.createdAt),
    updatedAt: isoOf(doc.updatedAt),
  }
}

function isDuplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000
}

async function requireConsent(organizationId: string, id: string) {
  parseObjectId(id)
  const consent = await CandidateConsentModel.findOne({ _id: id, organizationId }).populate([
    ...CONSENT_POPULATE,
  ])
  if (!consent) {
    throw AppError.notFound(MESSAGES.CONSENT_NOT_FOUND)
  }
  return consent
}

async function assertCandidate(organizationId: string, candidateId: string) {
  parseObjectId(candidateId, "Invalid candidate")
  const candidate = await CandidateModel.findOne({ _id: candidateId, organizationId }).select(
    "_id name firstName lastName email candidateNumber"
  )
  if (!candidate) {
    throw AppError.badRequest(MESSAGES.CANDIDATE_NOT_IN_ORGANIZATION)
  }
  return candidate
}

async function assertMandate(organizationId: string, mandateId: string) {
  parseObjectId(mandateId, "Invalid mandate")
  const mandate = await RecruitmentMandateModel.findOne({
    _id: mandateId,
    organizationId,
  }).select("_id mandateNumber position status")
  if (!mandate) {
    throw AppError.badRequest(MESSAGES.MANDATE_NOT_IN_ORGANIZATION)
  }
  return mandate
}

async function syncCandidateConsentSnapshot(organizationId: string, candidateId: string) {
  const latest = await CandidateConsentModel.findOne({
    organizationId,
    candidateId,
    consentGiven: true,
    withdrawnAt: null,
  })
    .sort({ consentDate: -1, createdAt: -1 })
    .select("consentDate consentMethod")
    .lean()

  await CandidateModel.updateOne(
    { _id: candidateId, organizationId },
    {
      consent: latest
        ? {
            given: true,
            date: latest.consentDate,
            method: latest.consentMethod || "",
          }
        : { given: false, date: null, method: "" },
    }
  )
}

export async function listConsents(auth: AuthContext, query: ConsentListQueryInput) {
  const filter: Record<string, unknown> = { organizationId: auth.organizationId }

  if (query.candidateId) {
    parseObjectId(query.candidateId, "Invalid candidate")
    filter.candidateId = query.candidateId
  }
  if (query.mandateId) {
    parseObjectId(query.mandateId, "Invalid mandate")
    filter.mandateId = query.mandateId
  }
  if (query.consentGiven === "true") {
    filter.consentGiven = true
    filter.withdrawnAt = null
  }
  if (query.consentGiven === "false") {
    filter.$or = [{ consentGiven: false }, { withdrawnAt: { $ne: null } }]
  }

  applySearch(
    filter,
    ["consentPurpose", "consentMethod", "consentDocument.fileName"],
    resolvedSearch(query)
  )

  const [items, total] = await Promise.all([
    CandidateConsentModel.find(filter)
      .populate([...CONSENT_POPULATE])
      .sort(mongoSort(query, { createdAt: -1 }))
      .skip(paginationSkip(query))
      .limit(query.limit)
      .lean(),
    CandidateConsentModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicConsent(item as Record<string, unknown>)),
    ...paginationMeta(total, query),
  }
}

export async function getConsent(auth: AuthContext, id: string) {
  const consent = await requireConsent(auth.organizationId, id)
  return toPublicConsent(consent.toObject() as Record<string, unknown>)
}

export async function createConsent(auth: AuthContext, input: CreateConsentInput) {
  const candidate = await assertCandidate(auth.organizationId, input.candidateId)
  const mandate = await assertMandate(auth.organizationId, input.mandateId)
  const consentGiven = input.consentGiven ?? true
  const consentDate = dateFromKey(input.consentDate) ?? (consentGiven ? new Date() : null)

  let created
  try {
    created = await CandidateConsentModel.create({
      organizationId: auth.organizationId,
      candidateId: candidate._id,
      mandateId: mandate._id,
      consentGiven,
      consentDate,
      consentMethod: input.consentMethod ?? "FORM",
      consentPurpose: input.consentPurpose ?? "SOURCING",
      consentDocument: documentOf(input.consentDocument),
      expiryDate: dateFromKey(input.expiryDate),
      withdrawnAt: consentGiven ? null : new Date(),
      createdBy: auth.userId,
    })
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw AppError.conflict(MESSAGES.CONSENT_EXISTS)
    }
    throw error
  }

  await syncCandidateConsentSnapshot(auth.organizationId, String(candidate._id))
  await created.populate([...CONSENT_POPULATE])
  const publicConsent = toPublicConsent(created.toObject() as Record<string, unknown>)
  await recordActivity(auth.organizationId, {
    title: `Consent recorded for ${candidate.name || "candidate"}`,
    detail: mandate.mandateNumber,
    tone: "success",
  })
  await recordAudit(auth, {
    module: "CONSENTS",
    action: "CREATED",
    recordId: publicConsent.id,
    newData: publicConsent,
  })

  return publicConsent
}

export async function updateConsent(auth: AuthContext, id: string, input: UpdateConsentInput) {
  const consent = await requireConsent(auth.organizationId, id)

  if (input.candidateId !== undefined) {
    const candidate = await assertCandidate(auth.organizationId, input.candidateId)
    consent.set("candidateId", candidate._id)
  }
  if (input.mandateId !== undefined) {
    const mandate = await assertMandate(auth.organizationId, input.mandateId)
    consent.set("mandateId", mandate._id)
  }
  if (input.consentDate !== undefined) consent.consentDate = dateFromKey(input.consentDate)
  if (input.consentMethod !== undefined) consent.consentMethod = input.consentMethod
  if (input.consentPurpose !== undefined) consent.consentPurpose = input.consentPurpose
  if (input.consentDocument !== undefined) {
    consent.set("consentDocument", documentOf(input.consentDocument))
  }
  if (input.expiryDate !== undefined) consent.expiryDate = dateFromKey(input.expiryDate)

  if (input.consentGiven === false || input.withdrawnAt) {
    consent.consentGiven = false
    consent.withdrawnAt = dateFromKey(input.withdrawnAt) ?? consent.withdrawnAt ?? new Date()
  } else if (input.consentGiven === true) {
    consent.consentGiven = true
    consent.withdrawnAt = null
    if (!consent.consentDate) consent.consentDate = new Date()
  }

  try {
    await consent.save()
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw AppError.conflict(MESSAGES.CONSENT_EXISTS)
    }
    throw error
  }

  await syncCandidateConsentSnapshot(auth.organizationId, asId(consent.candidateId))
  await consent.populate([...CONSENT_POPULATE])
  return toPublicConsent(consent.toObject() as Record<string, unknown>)
}

export async function deleteConsent(auth: AuthContext, id: string) {
  parseObjectId(id)
  const deleted = await CandidateConsentModel.findOneAndDelete({
    _id: id,
    organizationId: auth.organizationId,
  })
  if (!deleted) {
    throw AppError.notFound(MESSAGES.CONSENT_NOT_FOUND)
  }
  await syncCandidateConsentSnapshot(auth.organizationId, String(deleted.candidateId))
}
