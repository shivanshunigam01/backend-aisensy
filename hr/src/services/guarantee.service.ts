import {
  DEFAULT_GUARANTEE_DAYS,
  GUARANTEE_MILESTONE_STATUS_LABELS,
  RETENTION_STATUS_LABELS,
  type GuaranteeMilestoneStatus,
  type RetentionStatus,
} from "../constants/guarantees.js"
import { DEFAULT_REPLACEMENT_PERIOD_DAYS } from "../constants/agreements.js"
import { MESSAGES } from "../constants/messages.js"
import { CandidateModel } from "../models/candidate.model.js"
import { ClientModel } from "../models/client.model.js"
import { GuaranteeFollowUpModel } from "../models/guarantee-follow-up.model.js"
import { JoiningModel } from "../models/joining.model.js"
import { RecruitmentMandateModel } from "../models/recruitment-mandate.model.js"
import type { AuthContext } from "../types/auth.js"
import { recordActivity } from "../utils/activity.js"
import { recordAudit } from "../utils/audit.js"
import { AppError } from "../utils/app-error.js"
import { utcDateFromKey } from "../utils/dates.js"
import { planGuaranteeMilestones } from "../utils/guarantee-period.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { applySearch, mongoSort, resolvedSearch } from "../utils/search.js"
import type {
  CreateGuaranteeInput,
  GuaranteeListQueryInput,
  GuaranteeMilestoneInput,
  UpdateGuaranteeInput,
} from "../validators/guarantee.validators.js"

const GUARANTEE_POPULATE = [
  { path: "candidateId", select: "firstName lastName name email candidateNumber" },
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

function toPublicMilestone(value: unknown) {
  const milestone = (value ?? {}) as {
    status?: string
    completedAt?: unknown
    clientFeedback?: string
    candidateFeedback?: string
  }
  const status = (String(milestone.status ?? "PENDING") as GuaranteeMilestoneStatus) || "PENDING"
  return {
    status,
    statusLabel: GUARANTEE_MILESTONE_STATUS_LABELS[status] ?? status,
    completedAt: dateKeyOf(milestone.completedAt),
    clientFeedback: String(milestone.clientFeedback ?? ""),
    candidateFeedback: String(milestone.candidateFeedback ?? ""),
  }
}

function emptyMilestone() {
  return {
    status: "PENDING" as GuaranteeMilestoneStatus,
    completedAt: null as Date | null,
    clientFeedback: "",
    candidateFeedback: "",
  }
}

function applyMilestone(
  input: GuaranteeMilestoneInput | undefined,
  current?: {
    status?: string
    completedAt?: Date | null
    clientFeedback?: string
    candidateFeedback?: string
  } | null
) {
  const fallback = current ?? emptyMilestone()
  const status = (input?.status ?? fallback.status ?? "PENDING") as GuaranteeMilestoneStatus
  let completedAt =
    input?.completedAt !== undefined ? dateFromKey(input.completedAt) : fallback.completedAt ?? null
  if (status === "COMPLETED" && !completedAt) {
    completedAt = new Date()
  }
  return {
    status,
    completedAt,
    clientFeedback: input?.clientFeedback ?? fallback.clientFeedback ?? "",
    candidateFeedback: input?.candidateFeedback ?? fallback.candidateFeedback ?? "",
  }
}

export function toPublicGuarantee(doc: Record<string, unknown>) {
  const candidate = toCandidateRef(doc.candidateId)
  const joining = toJoiningRef(doc.joiningId)
  const mandate = toMandateRef(doc.mandateId)
  const client = toClientRef(doc.clientId)
  const retentionStatus = (String(doc.retentionStatus ?? "IN_PROGRESS") as RetentionStatus) || "IN_PROGRESS"

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    candidateId: candidate?.id ?? asId(doc.candidateId),
    candidate,
    joiningId: joining?.id ?? asId(doc.joiningId),
    joining,
    mandateId: mandate?.id ?? asId(doc.mandateId),
    mandate,
    clientId: client?.id ?? asId(doc.clientId),
    client,
    joiningDate: dateKeyOf(doc.joiningDate),
    guaranteeStartDate: dateKeyOf(doc.guaranteeStartDate),
    guaranteeEndDate: dateKeyOf(doc.guaranteeEndDate),
    milestone30: toPublicMilestone(doc.milestone30),
    milestone60: toPublicMilestone(doc.milestone60),
    milestone90: toPublicMilestone(doc.milestone90),
    milestone30Enabled: doc.milestone30Enabled !== false,
    milestone60Enabled: doc.milestone60Enabled !== false,
    milestone90Enabled: doc.milestone90Enabled !== false,
    replacementPeriodDays:
      doc.replacementPeriodDays === null || doc.replacementPeriodDays === undefined
        ? null
        : Number(doc.replacementPeriodDays),
    retentionStatus,
    retentionStatusLabel: RETENTION_STATUS_LABELS[retentionStatus] ?? retentionStatus,
    createdAt: isoOf(doc.createdAt),
    updatedAt: isoOf(doc.updatedAt),
  }
}

async function requireGuarantee(organizationId: string, id: string) {
  parseObjectId(id)
  const guarantee = await GuaranteeFollowUpModel.findOne({ _id: id, organizationId }).populate([
    ...GUARANTEE_POPULATE,
  ])
  if (!guarantee) {
    throw AppError.notFound(MESSAGES.GUARANTEE_NOT_FOUND)
  }
  return guarantee
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
    "_id mandateNumber position status clientId replacementPeriodDays agreementId"
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

async function assertNoGuarantee(organizationId: string, joiningId: string, excludeId?: string) {
  const existing = await GuaranteeFollowUpModel.findOne({
    organizationId,
    joiningId,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select("_id")
  if (existing) {
    throw AppError.conflict(MESSAGES.GUARANTEE_EXISTS)
  }
}

export async function listGuarantees(auth: AuthContext, query: GuaranteeListQueryInput) {
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
  if (query.retentionStatus) filter.retentionStatus = query.retentionStatus

  applySearch(
    filter,
    [
      "milestone30.clientFeedback",
      "milestone30.candidateFeedback",
      "milestone60.clientFeedback",
      "milestone60.candidateFeedback",
      "milestone90.clientFeedback",
      "milestone90.candidateFeedback",
    ],
    resolvedSearch(query)
  )

  const [items, total] = await Promise.all([
    GuaranteeFollowUpModel.find(filter)
      .populate([...GUARANTEE_POPULATE])
      .sort(mongoSort(query, { guaranteeEndDate: -1, createdAt: -1 }))
      .skip(paginationSkip(query))
      .limit(query.limit)
      .lean(),
    GuaranteeFollowUpModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicGuarantee(item as Record<string, unknown>)),
    ...paginationMeta(total, query),
  }
}

export async function getGuarantee(auth: AuthContext, id: string) {
  const guarantee = await requireGuarantee(auth.organizationId, id)
  return toPublicGuarantee(guarantee.toObject() as Record<string, unknown>)
}

export async function createGuarantee(auth: AuthContext, input: CreateGuaranteeInput) {
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

  const joiningDate = dateFromKey(input.joiningDate) ?? joining.joiningDate ?? new Date()
  const replacementPeriodDays = Number(
    mandate.replacementPeriodDays ?? DEFAULT_REPLACEMENT_PERIOD_DAYS ?? DEFAULT_GUARANTEE_DAYS
  )
  const plan = planGuaranteeMilestones(joiningDate, replacementPeriodDays)
  const guaranteeStartDate = dateFromKey(input.guaranteeStartDate) ?? plan.guaranteeStartDate
  const guaranteeEndDate = dateFromKey(input.guaranteeEndDate) ?? plan.guaranteeEndDate

  await assertNoGuarantee(auth.organizationId, String(joining._id))

  let created
  try {
    created = await GuaranteeFollowUpModel.create({
      organizationId: auth.organizationId,
      candidateId: candidate._id,
      joiningId: joining._id,
      mandateId: mandate._id,
      clientId,
      joiningDate,
      guaranteeStartDate,
      guaranteeEndDate,
      milestone30Enabled: plan.milestone30Enabled,
      milestone60Enabled: plan.milestone60Enabled,
      milestone90Enabled: plan.milestone90Enabled,
      replacementPeriodDays: plan.replacementPeriodDays,
      milestone30: applyMilestone(input.milestone30),
      milestone60: applyMilestone(input.milestone60),
      milestone90: applyMilestone(input.milestone90),
      retentionStatus: input.retentionStatus ?? "IN_PROGRESS",
    })
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw AppError.conflict(MESSAGES.GUARANTEE_EXISTS)
    }
    throw error
  }

  await created.populate([...GUARANTEE_POPULATE])
  const publicGuarantee = toPublicGuarantee(created.toObject() as Record<string, unknown>)
  await recordActivity(auth.organizationId, {
    title: `Guarantee tracking started for ${candidate.name || "candidate"}`,
    detail: `${mandate.mandateNumber} · ${plan.replacementPeriodDays} days`,
    tone: "success",
  })
  await recordAudit(auth, {
    module: "GUARANTEES",
    action: "CREATED",
    recordId: publicGuarantee.id,
    newData: publicGuarantee,
  })

  return publicGuarantee
}

export async function updateGuarantee(auth: AuthContext, id: string, input: UpdateGuaranteeInput) {
  const guarantee = await requireGuarantee(auth.organizationId, id)

  if (input.joiningId !== undefined) {
    const joining = await assertJoining(auth.organizationId, input.joiningId)
    guarantee.set("joiningId", joining._id)
    if (input.candidateId === undefined) guarantee.set("candidateId", joining.candidateId)
    if (input.mandateId === undefined) guarantee.set("mandateId", joining.mandateId)
    if (input.clientId === undefined) guarantee.set("clientId", joining.clientId)
    if (input.joiningDate === undefined) guarantee.set("joiningDate", joining.joiningDate)
  }
  if (input.candidateId !== undefined) {
    const candidate = await assertCandidate(auth.organizationId, input.candidateId)
    guarantee.set("candidateId", candidate._id)
  }
  if (input.mandateId !== undefined) {
    const mandate = await assertMandate(auth.organizationId, input.mandateId)
    guarantee.set("mandateId", mandate._id)
  }
  if (input.clientId !== undefined) {
    const client = await assertClient(auth.organizationId, input.clientId)
    guarantee.set("clientId", client._id)
  }

  const joining = await assertJoining(auth.organizationId, asId(guarantee.joiningId))
  if (String(joining.candidateId) !== asId(guarantee.candidateId)) {
    throw AppError.badRequest(MESSAGES.JOINING_CANDIDATE_MISMATCH)
  }
  if (String(joining.mandateId) !== asId(guarantee.mandateId)) {
    throw AppError.badRequest(MESSAGES.JOINING_MANDATE_MISMATCH)
  }
  if (String(joining.clientId) !== asId(guarantee.clientId)) {
    throw AppError.badRequest(MESSAGES.JOINING_CLIENT_MISMATCH)
  }

  if (input.joiningDate !== undefined) {
    guarantee.joiningDate = dateFromKey(input.joiningDate) ?? guarantee.joiningDate
  }
  if (input.guaranteeStartDate !== undefined) {
    guarantee.guaranteeStartDate = dateFromKey(input.guaranteeStartDate) ?? guarantee.guaranteeStartDate
  }
  if (input.guaranteeEndDate !== undefined) {
    guarantee.guaranteeEndDate = dateFromKey(input.guaranteeEndDate) ?? guarantee.guaranteeEndDate
  }
  if (input.retentionStatus !== undefined) guarantee.retentionStatus = input.retentionStatus
  if (input.milestone30 !== undefined) {
    guarantee.set("milestone30", applyMilestone(input.milestone30, guarantee.milestone30))
  }
  if (input.milestone60 !== undefined) {
    guarantee.set("milestone60", applyMilestone(input.milestone60, guarantee.milestone60))
  }
  if (input.milestone90 !== undefined) {
    guarantee.set("milestone90", applyMilestone(input.milestone90, guarantee.milestone90))
  }

  await assertNoGuarantee(auth.organizationId, asId(guarantee.joiningId), id)

  try {
    await guarantee.save()
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw AppError.conflict(MESSAGES.GUARANTEE_EXISTS)
    }
    throw error
  }

  await guarantee.populate([...GUARANTEE_POPULATE])
  return toPublicGuarantee(guarantee.toObject() as Record<string, unknown>)
}

export async function deleteGuarantee(auth: AuthContext, id: string) {
  parseObjectId(id)
  const deleted = await GuaranteeFollowUpModel.findOneAndDelete({
    _id: id,
    organizationId: auth.organizationId,
  })
  if (!deleted) {
    throw AppError.notFound(MESSAGES.GUARANTEE_NOT_FOUND)
  }
}
