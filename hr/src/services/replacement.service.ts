import {
  MAX_FREE_REPLACEMENTS,
  REPLACEMENT_ELIGIBILITY_LABELS,
  REPLACEMENT_OPEN_STATUSES,
  REPLACEMENT_REASON_LABELS,
  REPLACEMENT_STATUS_LABELS,
  isClosedReplacementStatus,
  isOpenReplacementStatus,
  type ReplacementEligibilityResult,
  type ReplacementReason,
  type ReplacementStatus,
} from "../constants/replacements.js"
import { DEFAULT_REPLACEMENT_PERIOD_DAYS } from "../constants/agreements.js"
import { MESSAGES } from "../constants/messages.js"
import { CandidateModel } from "../models/candidate.model.js"
import { ClientModel } from "../models/client.model.js"
import { InvoiceModel } from "../models/invoice.model.js"
import { JoiningModel } from "../models/joining.model.js"
import { RecruitmentMandateModel } from "../models/recruitment-mandate.model.js"
import { ReplacementCaseModel } from "../models/replacement-case.model.js"
import type { AuthContext } from "../types/auth.js"
import { recordActivity } from "../utils/activity.js"
import { recordAudit } from "../utils/audit.js"
import { AppError } from "../utils/app-error.js"
import { utcDateFromKey } from "../utils/dates.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { evaluateReplacementEligibility } from "../utils/replacement-eligibility.js"
import { applySearch, mongoSort, resolvedSearch } from "../utils/search.js"
import type {
  CreateReplacementInput,
  ReplacementListQueryInput,
  UpdateReplacementInput,
} from "../validators/replacement.validators.js"

const REPLACEMENT_POPULATE = [
  { path: "candidateId", select: "firstName lastName name email candidateNumber" },
  { path: "replacementCandidateId", select: "firstName lastName name email candidateNumber" },
  { path: "joiningId", select: "joiningDate status" },
  { path: "mandateId", select: "mandateNumber position status" },
  { path: "clientId", select: "companyName" },
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

function dateFromKey(value?: string | null) {
  if (!value) return null
  return utcDateFromKey(value)
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function isDuplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000
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
  if (typeof value === "object" && value !== null && ("mandateNumber" in value || "_id" in value)) {
    const mandate = value as {
      _id: unknown
      mandateNumber?: string
      position?: string
      status?: string
    }
    return {
      id: String(mandate._id),
      mandateNumber: mandate.mandateNumber ?? "",
      position: mandate.position ?? "",
      status: mandate.status ?? "",
    }
  }
  return { id: String(value), mandateNumber: "", position: "", status: "" }
}

function toJoiningRef(value: unknown) {
  if (!value) return null
  if (typeof value === "object" && value !== null && ("joiningDate" in value || "_id" in value)) {
    const joining = value as { _id: unknown; joiningDate?: unknown; status?: string }
    return {
      id: String(joining._id),
      joiningDate: dateKeyOf(joining.joiningDate),
      status: joining.status ?? "",
    }
  }
  return { id: String(value), joiningDate: "", status: "" }
}

function toClientRef(value: unknown) {
  if (!value) return null
  if (typeof value === "object" && value !== null && ("companyName" in value || "_id" in value)) {
    const client = value as { _id: unknown; companyName?: string }
    return { id: String(client._id), companyName: client.companyName ?? "" }
  }
  return { id: String(value), companyName: "" }
}

export function toPublicReplacement(doc: Record<string, unknown>) {
  const candidate = toCandidateRef(doc.candidateId)
  const replacementCandidate = doc.replacementCandidateId
    ? toCandidateRef(doc.replacementCandidateId)
    : null
  const joining = toJoiningRef(doc.joiningId)
  const mandate = toMandateRef(doc.mandateId)
  const client = toClientRef(doc.clientId)
  const replacementReason = (String(doc.replacementReason ?? "OTHER") as ReplacementReason) || "OTHER"
  const status = (String(doc.status ?? "REPLACEMENT_REQUESTED") as ReplacementStatus) || "REPLACEMENT_REQUESTED"
  const eligibilityResult = String(doc.eligibilityResult ?? "") as ReplacementEligibilityResult | ""

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    candidateId: candidate?.id ?? asId(doc.candidateId),
    candidate,
    mandateId: mandate?.id ?? asId(doc.mandateId),
    mandate,
    clientId: client?.id ?? asId(doc.clientId),
    client,
    joiningId: joining?.id ?? asId(doc.joiningId),
    joining,
    replacementReason,
    replacementReasonLabel: REPLACEMENT_REASON_LABELS[replacementReason] ?? replacementReason,
    replacementRequestedDate: dateKeyOf(doc.replacementRequestedDate),
    status,
    statusLabel: REPLACEMENT_STATUS_LABELS[status] ?? status,
    replacementCandidateId: replacementCandidate?.id ?? (doc.replacementCandidateId ? asId(doc.replacementCandidateId) : ""),
    replacementCandidate,
    eligibilityResult,
    eligibilityResultLabel: eligibilityResult
      ? (REPLACEMENT_ELIGIBILITY_LABELS[eligibilityResult as ReplacementEligibilityResult] ??
        eligibilityResult)
      : "",
    eligibilityReasons: Array.isArray(doc.eligibilityReasons)
      ? doc.eligibilityReasons.map((item) => String(item))
      : [],
    freeReplacement: Boolean(doc.freeReplacement),
    exclusions:
      doc.exclusions && typeof doc.exclusions === "object"
        ? (doc.exclusions as Record<string, boolean>)
        : {},
    manualOverride: Boolean(doc.manualOverride),
    closedAt: dateKeyOf(doc.closedAt),
    remarks: String(doc.remarks ?? ""),
    createdAt: isoOf(doc.createdAt),
    updatedAt: isoOf(doc.updatedAt),
  }
}

async function requireReplacement(organizationId: string, id: string) {
  parseObjectId(id)
  const replacement = await ReplacementCaseModel.findOne({ _id: id, organizationId }).populate([
    ...REPLACEMENT_POPULATE,
  ])
  if (!replacement) {
    throw AppError.notFound(MESSAGES.REPLACEMENT_NOT_FOUND)
  }
  return replacement
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
  const mandate = await RecruitmentMandateModel.findOne({ _id: mandateId, organizationId }).select(
    "_id mandateNumber position status clientId replacementPeriodDays"
  )
  if (!mandate) {
    throw AppError.badRequest(MESSAGES.MANDATE_NOT_FOUND)
  }
  return mandate
}

async function assertClient(organizationId: string, clientId: string) {
  parseObjectId(clientId, "Invalid client")
  const client = await ClientModel.findOne({ _id: clientId, organizationId }).select("_id companyName")
  if (!client) {
    throw AppError.badRequest(MESSAGES.CLIENT_NOT_IN_ORGANIZATION)
  }
  return client
}

async function assertJoining(organizationId: string, joiningId: string) {
  parseObjectId(joiningId, "Invalid joining")
  const joining = await JoiningModel.findOne({ _id: joiningId, organizationId }).select(
    "_id candidateId mandateId clientId joiningDate status"
  )
  if (!joining) {
    throw AppError.badRequest(MESSAGES.JOINING_NOT_FOUND)
  }
  return joining
}

async function assertNoOpenReplacement(organizationId: string, joiningId: string, excludeId?: string) {
  const existing = await ReplacementCaseModel.findOne({
    organizationId,
    joiningId,
    status: { $in: [...REPLACEMENT_OPEN_STATUSES] },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select("_id")
  if (existing) {
    throw AppError.conflict(MESSAGES.REPLACEMENT_EXISTS)
  }
}

function resolveStatus(status: ReplacementStatus | undefined, hasReplacementCandidate: boolean): ReplacementStatus {
  if (status) return status
  return hasReplacementCandidate ? "REPLACEMENT_IN_PROGRESS" : "REPLACEMENT_REQUESTED"
}

function resolveClosedAt(status: ReplacementStatus, closedAt?: string | null, current?: Date | null) {
  if (isClosedReplacementStatus(status)) {
    return dateFromKey(closedAt) ?? current ?? new Date()
  }
  if (closedAt !== undefined) return dateFromKey(closedAt)
  return null
}

export async function listReplacements(auth: AuthContext, query: ReplacementListQueryInput) {
  const filter: Record<string, unknown> = { organizationId: auth.organizationId }

  if (query.candidateId) {
    parseObjectId(query.candidateId, "Invalid candidate")
    filter.candidateId = query.candidateId
  }
  if (query.joiningId) {
    parseObjectId(query.joiningId, "Invalid joining")
    filter.joiningId = query.joiningId
  }
  if (query.mandateId) {
    parseObjectId(query.mandateId, "Invalid mandate")
    filter.mandateId = query.mandateId
  }
  if (query.clientId) {
    parseObjectId(query.clientId, "Invalid client")
    filter.clientId = query.clientId
  }
  if (query.status) filter.status = query.status

  applySearch(filter, ["remarks"], resolvedSearch(query))

  const [items, total] = await Promise.all([
    ReplacementCaseModel.find(filter)
      .populate([...REPLACEMENT_POPULATE])
      .sort(mongoSort(query, { replacementRequestedDate: -1, createdAt: -1 }))
      .skip(paginationSkip(query))
      .limit(query.limit)
      .lean(),
    ReplacementCaseModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicReplacement(item as Record<string, unknown>)),
    ...paginationMeta(total, query),
  }
}

export async function getReplacement(auth: AuthContext, id: string) {
  const replacement = await requireReplacement(auth.organizationId, id)
  return toPublicReplacement(replacement.toObject() as Record<string, unknown>)
}

export async function createReplacement(auth: AuthContext, input: CreateReplacementInput) {
  const joining = await assertJoining(auth.organizationId, input.joiningId)
  const candidateId = input.candidateId ?? String(joining.candidateId)
  const mandateId = input.mandateId ?? String(joining.mandateId)
  const clientId = input.clientId ?? String(joining.clientId)

  if (String(joining.candidateId) !== candidateId) {
    throw AppError.badRequest(MESSAGES.JOINING_CANDIDATE_MISMATCH)
  }
  if (String(joining.mandateId) !== mandateId) {
    throw AppError.badRequest(MESSAGES.JOINING_MANDATE_MISMATCH)
  }
  if (String(joining.clientId) !== clientId) {
    throw AppError.badRequest(MESSAGES.JOINING_CLIENT_MISMATCH)
  }

  const candidate = await assertCandidate(auth.organizationId, candidateId)
  const mandate = await assertMandate(auth.organizationId, mandateId)
  await assertClient(auth.organizationId, clientId)

  let replacementCandidateId: typeof candidate._id | null = null
  if (input.replacementCandidateId) {
    if (input.replacementCandidateId === candidateId) {
      throw AppError.badRequest(MESSAGES.REPLACEMENT_CANDIDATE_SAME)
    }
    const replacementCandidate = await assertCandidate(auth.organizationId, input.replacementCandidateId)
    replacementCandidateId = replacementCandidate._id
  }

  const replacementRequestedDate =
    dateFromKey(input.replacementRequestedDate) ?? utcDateFromKey(todayKey())
  const joiningDate = joining.joiningDate ?? new Date()
  const replacementPeriodDays = Number(
    mandate.replacementPeriodDays ?? DEFAULT_REPLACEMENT_PERIOD_DAYS
  )

  const invoices = await InvoiceModel.find({
    organizationId: auth.organizationId,
    joiningId: joining._id,
    status: { $ne: "CANCELLED" },
  }).select("status paidAmount outstandingAmount dueDate amount")

  let invoicePaidOnTime: boolean | null = null
  if (invoices.length) {
    const anyOutstanding = invoices.some(
      (invoice) =>
        String(invoice.status) !== "PAID" && Number(invoice.outstandingAmount ?? 0) > 0
    )
    if (anyOutstanding) {
      invoicePaidOnTime = false
    } else {
      // All settled: on-time if every invoice's dueDate is null or was not overdue when paid
      invoicePaidOnTime = invoices.every((invoice) => {
        if (!invoice.dueDate) return true
        // Without payment timestamps, treat PAID with dueDate in the past as still on-time if PAID
        return String(invoice.status) === "PAID" || Number(invoice.outstandingAmount ?? 0) <= 0
      })
    }
  }

  const priorFree = await ReplacementCaseModel.countDocuments({
    organizationId: auth.organizationId,
    joiningId: joining._id,
    $or: [{ freeReplacement: true }, { freeReplacementUsed: true }],
  })

  const exclusions = input.exclusions ?? {}
  const manualOverride = Boolean(input.manualOverride)
  const eligibility = evaluateReplacementEligibility({
    joiningDate,
    requestedDate: replacementRequestedDate,
    replacementPeriodDays,
    reason: input.replacementReason,
    exclusions,
    invoicePaidOnTime,
    freeReplacementsUsed: priorFree,
    maxFreeReplacements: MAX_FREE_REPLACEMENTS,
    manualOverride,
  })

  if (eligibility.result === "NOT_ELIGIBLE" && !manualOverride) {
    throw AppError.badRequest(MESSAGES.REPLACEMENT_NOT_ELIGIBLE)
  }

  let status = resolveStatus(input.status, Boolean(replacementCandidateId))
  if (eligibility.result === "REVIEW" && !manualOverride && !input.status) {
    status = "REPLACEMENT_REQUESTED"
  }
  if (status === "REPLACED" && !replacementCandidateId) {
    throw AppError.badRequest(MESSAGES.REPLACEMENT_CANDIDATE_REQUIRED)
  }

  const closedAt = resolveClosedAt(status, input.closedAt)

  if (isOpenReplacementStatus(status)) {
    await assertNoOpenReplacement(auth.organizationId, String(joining._id))
  }

  let created
  try {
    created = await ReplacementCaseModel.create({
      organizationId: auth.organizationId,
      candidateId: candidate._id,
      mandateId: mandate._id,
      clientId,
      joiningId: joining._id,
      replacementReason: input.replacementReason,
      replacementRequestedDate,
      status,
      replacementCandidateId,
      closedAt,
      eligibilityResult: eligibility.result,
      eligibilityReasons: eligibility.reasons,
      freeReplacement: eligibility.result === "APPROVED" && eligibility.freeReplacementAvailable,
      freeReplacementUsed: false,
      manualOverride,
      exclusions,
      remarks: input.remarks ?? "",
    })
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw AppError.conflict(MESSAGES.REPLACEMENT_EXISTS)
    }
    throw error
  }

  await created.populate([...REPLACEMENT_POPULATE])
  const publicReplacement = toPublicReplacement(created.toObject() as Record<string, unknown>)
  await recordActivity(auth.organizationId, {
    title: `Replacement case opened for ${candidate.name || "candidate"}`,
    detail: `${mandate.mandateNumber} · ${REPLACEMENT_STATUS_LABELS[status]}`,
    tone: "warning",
  })
  await recordAudit(auth, {
    module: "REPLACEMENTS",
    action: "CREATED",
    recordId: publicReplacement.id,
    newData: {
      ...publicReplacement,
      eligibility: {
        result: eligibility.result,
        reasons: eligibility.reasons,
        withinGuaranteePeriod: eligibility.withinGuaranteePeriod,
        freeReplacementAvailable: eligibility.freeReplacementAvailable,
      },
    },
  })

  return publicReplacement
}

export async function updateReplacement(auth: AuthContext, id: string, input: UpdateReplacementInput) {
  const replacement = await requireReplacement(auth.organizationId, id)

  if (input.joiningId !== undefined) {
    const joining = await assertJoining(auth.organizationId, input.joiningId)
    replacement.set("joiningId", joining._id)
    if (input.candidateId === undefined) replacement.set("candidateId", joining.candidateId)
    if (input.mandateId === undefined) replacement.set("mandateId", joining.mandateId)
    if (input.clientId === undefined) replacement.set("clientId", joining.clientId)
  }
  if (input.candidateId !== undefined) {
    const candidate = await assertCandidate(auth.organizationId, input.candidateId)
    replacement.set("candidateId", candidate._id)
  }
  if (input.mandateId !== undefined) {
    const mandate = await assertMandate(auth.organizationId, input.mandateId)
    replacement.set("mandateId", mandate._id)
  }
  if (input.clientId !== undefined) {
    const client = await assertClient(auth.organizationId, input.clientId)
    replacement.set("clientId", client._id)
  }

  const joining = await assertJoining(auth.organizationId, asId(replacement.joiningId))
  if (String(joining.candidateId) !== asId(replacement.candidateId)) {
    throw AppError.badRequest(MESSAGES.JOINING_CANDIDATE_MISMATCH)
  }
  if (String(joining.mandateId) !== asId(replacement.mandateId)) {
    throw AppError.badRequest(MESSAGES.JOINING_MANDATE_MISMATCH)
  }
  if (String(joining.clientId) !== asId(replacement.clientId)) {
    throw AppError.badRequest(MESSAGES.JOINING_CLIENT_MISMATCH)
  }

  if (input.replacementReason !== undefined) replacement.replacementReason = input.replacementReason
  if (input.replacementRequestedDate !== undefined) {
    replacement.replacementRequestedDate =
      dateFromKey(input.replacementRequestedDate) ?? replacement.replacementRequestedDate
  }
  if (input.remarks !== undefined) replacement.remarks = input.remarks

  if (input.replacementCandidateId !== undefined) {
    if (!input.replacementCandidateId) {
      replacement.set("replacementCandidateId", null)
    } else {
      if (input.replacementCandidateId === asId(replacement.candidateId)) {
        throw AppError.badRequest(MESSAGES.REPLACEMENT_CANDIDATE_SAME)
      }
      const replacementCandidate = await assertCandidate(
        auth.organizationId,
        input.replacementCandidateId
      )
      replacement.set("replacementCandidateId", replacementCandidate._id)
    }
  }

  const hasReplacementCandidate = Boolean(asId(replacement.replacementCandidateId))
  const status = resolveStatus(input.status ?? (replacement.status as ReplacementStatus), hasReplacementCandidate)
  if (status === "REPLACED" && !hasReplacementCandidate) {
    throw AppError.badRequest(MESSAGES.REPLACEMENT_CANDIDATE_REQUIRED)
  }
  replacement.status = status
  replacement.closedAt = resolveClosedAt(
    status,
    input.closedAt,
    replacement.closedAt ?? null
  )

  if (isOpenReplacementStatus(status)) {
    await assertNoOpenReplacement(auth.organizationId, asId(replacement.joiningId), id)
  }

  try {
    await replacement.save()
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw AppError.conflict(MESSAGES.REPLACEMENT_EXISTS)
    }
    throw error
  }

  await replacement.populate([...REPLACEMENT_POPULATE])
  return toPublicReplacement(replacement.toObject() as Record<string, unknown>)
}

export async function deleteReplacement(auth: AuthContext, id: string) {
  parseObjectId(id)
  const deleted = await ReplacementCaseModel.findOneAndDelete({
    _id: id,
    organizationId: auth.organizationId,
  })
  if (!deleted) {
    throw AppError.notFound(MESSAGES.REPLACEMENT_NOT_FOUND)
  }
}
