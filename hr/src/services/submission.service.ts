import {
  isActiveSubmissionStatus,
  isIntroducedSubmissionStatus,
  OWNERSHIP_STATUS_LABELS,
  SUBMISSION_ACTIVE_STATUSES,
  SUBMISSION_DUPLICATE_STATUS_LABELS,
  SUBMISSION_STATUS_LABELS,
  type OwnershipStatus,
  type SubmissionDuplicateStatus,
  type SubmissionStatus,
} from "../constants/submissions.js"
import { MESSAGES } from "../constants/messages.js"
import { CandidateEvaluationModel } from "../models/candidate-evaluation.model.js"
import { CandidateModel } from "../models/candidate.model.js"
import { CandidateSubmissionModel } from "../models/candidate-submission.model.js"
import { InterviewModel } from "../models/interview.model.js"
import { OfferModel } from "../models/offer.model.js"
import { ClientModel } from "../models/client.model.js"
import { RecruitmentMandateModel } from "../models/recruitment-mandate.model.js"
import { UserModel } from "../models/user.model.js"
import type { AuthContext } from "../types/auth.js"
import { recordActivity } from "../utils/activity.js"
import { recordAudit } from "../utils/audit.js"
import { AppError } from "../utils/app-error.js"
import { utcDateFromKey } from "../utils/dates.js"
import { calculateOwnershipWindow, resolveOwnershipStatus } from "../utils/ownership.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { assertSubmissionWorkflowReady } from "../utils/placement-workflow.js"
import { applySearch, mongoSort, resolvedSearch } from "../utils/search.js"
import { addWorkingDays, isPastWorkingDayDeadline } from "../utils/working-days.js"
import type {
  CreateSubmissionInput,
  SubmissionListQueryInput,
  UpdateSubmissionInput,
} from "../validators/submission.validators.js"

const SUBMISSION_POPULATE = [
  { path: "candidateId", select: "firstName lastName name email candidateNumber" },
  { path: "clientId", select: "companyName status" },
  { path: "mandateId", select: "mandateNumber position status clientId" },
  { path: "evaluationId", select: "totalScore recommendation scoringVersion" },
  { path: "submittedBy", select: "name email role" },
  { path: "firstIntroducedBy", select: "name email role" },
] as const

const DUPLICATE_CLAIM_STATUSES = new Set([
  "POSSIBLE_DUPLICATE",
  "CONFIRMED_DUPLICATE",
  "DISPUTED",
])

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

function toClientRef(value: unknown) {
  if (!value) return null
  if (typeof value === "object" && value !== null && "companyName" in value) {
    const client = value as { _id: unknown; companyName: string; status?: string }
    return {
      id: String(client._id),
      companyName: client.companyName,
      status: client.status ?? "",
    }
  }
  return { id: String(value), companyName: "", status: "" }
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

function toEvaluationRef(value: unknown) {
  if (!value) return null
  if (typeof value === "object" && value !== null && ("totalScore" in value || "recommendation" in value)) {
    const evaluation = value as { _id: unknown; totalScore?: number; recommendation?: string }
    return {
      id: String(evaluation._id),
      totalScore: Number(evaluation.totalScore ?? 0),
      recommendation: String(evaluation.recommendation ?? ""),
    }
  }
  if (typeof value === "string" || (typeof value === "object" && value !== null && "_id" in value)) {
    return { id: asId(value), totalScore: 0, recommendation: "" }
  }
  return null
}

export function toPublicSubmission(doc: Record<string, unknown>) {
  const candidate = toCandidateRef(doc.candidateId)
  const client = toClientRef(doc.clientId)
  const mandate = toMandateRef(doc.mandateId)
  const evaluation = toEvaluationRef(doc.evaluationId)
  const submittedBy = toUserRef(doc.submittedBy)
  const firstIntroducedBy = doc.firstIntroducedBy ? toUserRef(doc.firstIntroducedBy) : null
  const status = (String(doc.status ?? "DRAFT") as SubmissionStatus) || "DRAFT"
  const duplicateStatus =
    (String(doc.duplicateStatus ?? "NOT_CHECKED") as SubmissionDuplicateStatus) || "NOT_CHECKED"
  const ownershipStatusRaw = String(doc.ownershipStatus ?? "")
  const ownershipStatus = (ownershipStatusRaw as OwnershipStatus) || ""

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    candidateId: candidate?.id ?? asId(doc.candidateId),
    candidate,
    clientId: client?.id ?? asId(doc.clientId),
    client,
    mandateId: mandate?.id ?? asId(doc.mandateId),
    mandate,
    evaluationId: evaluation?.id || "",
    evaluation,
    submittedById: submittedBy?.id ?? asId(doc.submittedBy),
    submittedBy,
    firstIntroducedById: firstIntroducedBy?.id ?? (asId(doc.firstIntroducedBy) || ""),
    firstIntroducedBy,
    submittedAt: dateKeyOf(doc.submittedAt),
    ownershipStartDate: dateKeyOf(doc.ownershipStartDate),
    ownershipEndDate: dateKeyOf(doc.ownershipEndDate),
    ownershipStatus,
    ownershipStatusLabel: ownershipStatus
      ? (OWNERSHIP_STATUS_LABELS[ownershipStatus as OwnershipStatus] ?? ownershipStatus)
      : "",
    ownershipOverridden: Boolean(doc.ownershipOverridden),
    clientAcknowledgement: Boolean(doc.clientAcknowledgement),
    acknowledgementDate: dateKeyOf(doc.acknowledgementDate),
    duplicateStatus,
    duplicateStatusLabel: SUBMISSION_DUPLICATE_STATUS_LABELS[duplicateStatus] ?? duplicateStatus,
    duplicateEvidence: String(doc.duplicateEvidence ?? ""),
    duplicateNotificationDeadline: dateKeyOf(doc.duplicateNotificationDeadline),
    duplicateReportedAt: isoOf(doc.duplicateReportedAt) || dateKeyOf(doc.duplicateReportedAt),
    duplicateLateReport: Boolean(doc.duplicateLateReport),
    duplicateResolution: String(doc.duplicateResolution ?? ""),
    fitReasons: stringsOf(doc.fitReasons),
    risksGaps: stringsOf(doc.risksGaps),
    currentCompany: String(doc.currentCompany ?? ""),
    currentDesignation: String(doc.currentDesignation ?? ""),
    currentLocation: String(doc.currentLocation ?? ""),
    totalExperience:
      doc.totalExperience === null || doc.totalExperience === undefined
        ? null
        : Number(doc.totalExperience),
    currentCTC:
      doc.currentCTC === null || doc.currentCTC === undefined ? null : Number(doc.currentCTC),
    expectedCTC:
      doc.expectedCTC === null || doc.expectedCTC === undefined ? null : Number(doc.expectedCTC),
    noticePeriod: String(doc.noticePeriod ?? ""),
    evaluationScore:
      doc.evaluationScore === null || doc.evaluationScore === undefined
        ? null
        : Number(doc.evaluationScore),
    status,
    statusLabel: SUBMISSION_STATUS_LABELS[status] ?? status,
    remarks: String(doc.remarks ?? ""),
    createdAt: isoOf(doc.createdAt),
    updatedAt: isoOf(doc.updatedAt),
  }
}

async function requireSubmission(organizationId: string, id: string) {
  parseObjectId(id)
  const submission = await CandidateSubmissionModel.findOne({
    _id: id,
    organizationId,
  }).populate([...SUBMISSION_POPULATE])

  if (!submission) {
    throw AppError.notFound(MESSAGES.SUBMISSION_NOT_FOUND)
  }

  return submission
}

async function assertCandidate(organizationId: string, candidateId: string) {
  parseObjectId(candidateId, "Invalid candidate")
  const candidate = await CandidateModel.findOne({ _id: candidateId, organizationId }).select(
    "_id name firstName lastName email candidateNumber currentCompany currentDesignation currentLocation totalExperience experience currentCTC expectedCTC noticePeriod"
  )
  if (!candidate) {
    throw AppError.badRequest(MESSAGES.CANDIDATE_NOT_IN_ORGANIZATION)
  }
  return candidate
}

async function assertClient(organizationId: string, clientId: string) {
  parseObjectId(clientId, "Invalid client")
  const client = await ClientModel.findOne({ _id: clientId, organizationId }).select(
    "_id companyName status"
  )
  if (!client) {
    throw AppError.badRequest(MESSAGES.CLIENT_NOT_IN_ORGANIZATION)
  }
  return client
}

async function assertMandate(organizationId: string, mandateId: string) {
  parseObjectId(mandateId, "Invalid mandate")
  const mandate = await RecruitmentMandateModel.findOne({
    _id: mandateId,
    organizationId,
  }).select("_id mandateNumber position status clientId")
  if (!mandate) {
    throw AppError.badRequest(MESSAGES.MANDATE_NOT_IN_ORGANIZATION)
  }
  return mandate
}

async function assertSubmitter(organizationId: string, userId: string) {
  parseObjectId(userId, "Invalid submitter")
  const user = await UserModel.findOne({
    _id: userId,
    organizationId,
    isActive: true,
  }).select("_id")
  if (!user) {
    throw AppError.badRequest(MESSAGES.INVALID_RECRUITERS)
  }
  return user
}

async function assertEvaluation(
  organizationId: string,
  evaluationId: string,
  candidateId: string,
  mandateId: string
) {
  parseObjectId(evaluationId, "Invalid evaluation")
  const evaluation = await CandidateEvaluationModel.findOne({
    _id: evaluationId,
    organizationId,
  }).select("_id candidateId mandateId totalScore recommendation")
  if (!evaluation) {
    throw AppError.badRequest(MESSAGES.EVALUATION_NOT_FOUND)
  }
  if (String(evaluation.candidateId) !== String(candidateId)) {
    throw AppError.badRequest(MESSAGES.EVALUATION_CANDIDATE_MISMATCH)
  }
  if (String(evaluation.mandateId) !== String(mandateId)) {
    throw AppError.badRequest(MESSAGES.EVALUATION_MANDATE_MISMATCH)
  }
  return evaluation
}

async function assertNoActiveDuplicate(
  organizationId: string,
  candidateId: string,
  mandateId: string,
  excludeId?: string
) {
  const existing = await CandidateSubmissionModel.findOne({
    organizationId,
    candidateId,
    mandateId,
    status: { $in: [...SUBMISSION_ACTIVE_STATUSES] },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select("_id")

  if (existing) {
    throw AppError.conflict(MESSAGES.SUBMISSION_EXISTS)
  }
}

function submittedAtFor(status: SubmissionStatus, explicit?: string | null, current?: Date | null) {
  if (explicit) return dateFromKey(explicit)
  if (status === "DRAFT") return current ?? null
  return current ?? new Date()
}

function snapshotFromCandidate(
  candidate: {
    currentCompany?: string | null
    currentDesignation?: string | null
    currentLocation?: string | null
    totalExperience?: number | null
    experience?: number | null
    currentCTC?: number | null
    expectedCTC?: number | null
    noticePeriod?: string | null
  },
  input: Partial<CreateSubmissionInput>
) {
  return {
    currentCompany: input.currentCompany ?? String(candidate.currentCompany ?? ""),
    currentDesignation: input.currentDesignation ?? String(candidate.currentDesignation ?? ""),
    currentLocation: input.currentLocation ?? String(candidate.currentLocation ?? ""),
    totalExperience:
      input.totalExperience !== undefined && input.totalExperience !== null
        ? Number(input.totalExperience)
        : candidate.totalExperience ?? candidate.experience ?? null,
    currentCTC:
      input.currentCTC !== undefined && input.currentCTC !== null
        ? Number(input.currentCTC)
        : candidate.currentCTC ?? null,
    expectedCTC:
      input.expectedCTC !== undefined && input.expectedCTC !== null
        ? Number(input.expectedCTC)
        : candidate.expectedCTC ?? null,
    noticePeriod: input.noticePeriod ?? String(candidate.noticePeriod ?? ""),
  }
}

async function resolveOwnershipFields(input: {
  organizationId: string
  clientId: string
  candidateId: string
  submittedAt: Date
  submittedBy: string
  ownershipPeriodMonths: number
  existingStart?: Date | null
  existingEnd?: Date | null
  existingFirstIntroducedBy?: unknown
  ownershipStartDate?: string | null
  ownershipEndDate?: string | null
  ownershipOverridden?: boolean
  disputed?: boolean
}) {
  if (input.ownershipOverridden && (input.ownershipStartDate || input.ownershipEndDate)) {
    const ownershipStartDate =
      dateFromKey(input.ownershipStartDate) ?? input.existingStart ?? input.submittedAt
    const ownershipEndDate =
      dateFromKey(input.ownershipEndDate) ??
      calculateOwnershipWindow(ownershipStartDate, input.ownershipPeriodMonths).ownershipEndDate
    const ownershipStatus = resolveOwnershipStatus({
      ownershipStartDate,
      ownershipEndDate,
      disputed: input.disputed,
    })
    return {
      ownershipStartDate,
      ownershipEndDate,
      ownershipStatus,
      ownershipOverridden: true,
      firstIntroducedBy: input.existingFirstIntroducedBy ?? input.submittedBy,
      wasOverride: true,
    }
  }

  if (input.existingStart) {
    const ownershipStatus = resolveOwnershipStatus({
      ownershipStartDate: input.existingStart,
      ownershipEndDate: input.existingEnd,
      disputed: input.disputed,
    })
    return {
      ownershipStartDate: input.existingStart,
      ownershipEndDate: input.existingEnd ?? null,
      ownershipStatus,
      ownershipOverridden: false,
      firstIntroducedBy: input.existingFirstIntroducedBy ?? input.submittedBy,
      wasOverride: false,
    }
  }

  const prior = await CandidateSubmissionModel.findOne({
    organizationId: input.organizationId,
    clientId: input.clientId,
    candidateId: input.candidateId,
    ownershipStartDate: { $ne: null },
  })
    .sort({ ownershipStartDate: 1, createdAt: 1 })
    .select("ownershipStartDate ownershipEndDate firstIntroducedBy ownershipStatus")

  if (prior?.ownershipStartDate) {
    const ownershipStatus = resolveOwnershipStatus({
      ownershipStartDate: prior.ownershipStartDate,
      ownershipEndDate: prior.ownershipEndDate,
      disputed: input.disputed,
    })
    return {
      ownershipStartDate: prior.ownershipStartDate,
      ownershipEndDate: prior.ownershipEndDate ?? null,
      ownershipStatus,
      ownershipOverridden: false,
      firstIntroducedBy: prior.firstIntroducedBy ?? input.submittedBy,
      wasOverride: false,
    }
  }

  const window = calculateOwnershipWindow(input.submittedAt, input.ownershipPeriodMonths)
  const ownershipStatus = resolveOwnershipStatus({
    ownershipStartDate: window.ownershipStartDate,
    ownershipEndDate: window.ownershipEndDate,
    disputed: input.disputed,
  })
  return {
    ownershipStartDate: window.ownershipStartDate,
    ownershipEndDate: window.ownershipEndDate,
    ownershipStatus,
    ownershipOverridden: false,
    firstIntroducedBy: input.submittedBy,
    wasOverride: false,
  }
}

function applyDuplicateClaimFields(
  payload: Record<string, unknown>,
  duplicateStatus: string,
  authUserId: string,
  existingReportedAt?: Date | null
) {
  if (!DUPLICATE_CLAIM_STATUSES.has(duplicateStatus)) return
  const deadline = payload.duplicateNotificationDeadline as Date | null | undefined
  const reportedAt = existingReportedAt ?? new Date()
  if (!existingReportedAt) {
    payload.duplicateReportedAt = reportedAt
    payload.duplicateReportedBy = authUserId
  }
  if (deadline) {
    payload.duplicateLateReport = isPastWorkingDayDeadline(deadline, reportedAt)
  }
}

export async function listSubmissions(auth: AuthContext, query: SubmissionListQueryInput) {
  const filter: Record<string, unknown> = { organizationId: auth.organizationId }

  if (query.candidateId) {
    parseObjectId(query.candidateId, "Invalid candidate")
    filter.candidateId = query.candidateId
  }
  if (query.clientId) {
    parseObjectId(query.clientId, "Invalid client")
    filter.clientId = query.clientId
  }
  if (query.mandateId) {
    parseObjectId(query.mandateId, "Invalid mandate")
    filter.mandateId = query.mandateId
  }
  if (query.status) filter.status = query.status
  if (query.duplicateStatus) filter.duplicateStatus = query.duplicateStatus

  applySearch(filter, ["remarks", "duplicateEvidence"], resolvedSearch(query))

  const [items, total] = await Promise.all([
    CandidateSubmissionModel.find(filter)
      .populate([...SUBMISSION_POPULATE])
      .sort(mongoSort(query, { submittedAt: -1, createdAt: -1 }))
      .skip(paginationSkip(query))
      .limit(query.limit)
      .lean(),
    CandidateSubmissionModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicSubmission(item as Record<string, unknown>)),
    ...paginationMeta(total, query),
  }
}

export async function getSubmission(auth: AuthContext, id: string) {
  const submission = await requireSubmission(auth.organizationId, id)
  return toPublicSubmission(submission.toObject() as Record<string, unknown>)
}

export async function createSubmission(auth: AuthContext, input: CreateSubmissionInput) {
  const candidate = await assertCandidate(auth.organizationId, input.candidateId)
  const mandate = await assertMandate(auth.organizationId, input.mandateId)
  const clientId = input.clientId ?? String(mandate.clientId)
  const client = await assertClient(auth.organizationId, clientId)

  if (String(mandate.clientId) !== String(client._id)) {
    throw AppError.badRequest(MESSAGES.MANDATE_CLIENT_MISMATCH)
  }

  const submittedById = input.submittedBy ?? auth.userId
  await assertSubmitter(auth.organizationId, submittedById)

  const status = (input.status ?? "DRAFT") as SubmissionStatus
  const introducing = isIntroducedSubmissionStatus(status)

  let evaluationId = input.evaluationId ?? null
  let evaluationScore: number | null = null
  let commercialOwnershipMonths = 12
  let commercialDuplicateDays = 3

  if (introducing) {
    const workflow = await assertSubmissionWorkflowReady({
      organizationId: auth.organizationId,
      candidateId: String(candidate._id),
      mandateId: String(mandate._id),
      clientId: String(client._id),
      evaluationId,
      requireEvaluation: true,
    })
    if (!evaluationId && workflow.evaluation) {
      evaluationId = String(workflow.evaluation._id)
    }
    evaluationScore =
      workflow.evaluation?.totalScore !== undefined && workflow.evaluation?.totalScore !== null
        ? Number(workflow.evaluation.totalScore)
        : null
    commercialOwnershipMonths = workflow.commercial.ownershipPeriodMonths
    commercialDuplicateDays = workflow.commercial.duplicateNotificationDays

    const fitReasons = stringsOf(input.fitReasons)
    if (fitReasons.length < 1) {
      throw AppError.badRequest(MESSAGES.SUBMISSION_FIT_REASONS_REQUIRED)
    }
  } else if (evaluationId) {
    const evaluation = await assertEvaluation(
      auth.organizationId,
      evaluationId,
      String(candidate._id),
      String(mandate._id)
    )
    evaluationScore = Number(evaluation.totalScore ?? 0)
  }

  if (isActiveSubmissionStatus(status)) {
    await assertNoActiveDuplicate(auth.organizationId, String(candidate._id), String(mandate._id))
  }

  const acknowledged = input.clientAcknowledgement ?? false
  const submittedAt = submittedAtFor(status, input.submittedAt)
  const snapshot = snapshotFromCandidate(candidate, input)
  const fitReasons = stringsOf(input.fitReasons)
  const risksGaps = stringsOf(input.risksGaps)
  const duplicateStatus = input.duplicateStatus ?? "NOT_CHECKED"
  let pendingOwnershipOverride:
    | { ownershipStartDate: Date; ownershipEndDate: Date | null }
    | null = null

  const payload: Record<string, unknown> = {
    organizationId: auth.organizationId,
    candidateId: candidate._id,
    clientId: client._id,
    mandateId: mandate._id,
    evaluationId,
    submittedBy: submittedById,
    submittedAt,
    clientAcknowledgement: acknowledged,
    acknowledgementDate: acknowledged
      ? (dateFromKey(input.acknowledgementDate) ?? new Date())
      : dateFromKey(input.acknowledgementDate),
    duplicateStatus,
    duplicateEvidence: input.duplicateEvidence ?? "",
    duplicateResolution: input.duplicateResolution ?? "",
    fitReasons,
    risksGaps,
    ...snapshot,
    evaluationScore,
    status,
    remarks: input.remarks ?? "",
    ownershipOverridden: Boolean(input.ownershipOverridden),
  }

  if (introducing && submittedAt) {
    const ownership = await resolveOwnershipFields({
      organizationId: auth.organizationId,
      clientId: String(client._id),
      candidateId: String(candidate._id),
      submittedAt,
      submittedBy: submittedById,
      ownershipPeriodMonths: commercialOwnershipMonths,
      ownershipStartDate: input.ownershipStartDate,
      ownershipEndDate: input.ownershipEndDate,
      ownershipOverridden: input.ownershipOverridden,
      disputed: duplicateStatus === "DISPUTED",
    })
    payload.ownershipStartDate = ownership.ownershipStartDate
    payload.ownershipEndDate = ownership.ownershipEndDate
    payload.ownershipStatus = ownership.ownershipStatus
    payload.ownershipOverridden = ownership.ownershipOverridden
    payload.firstIntroducedBy = ownership.firstIntroducedBy
    payload.duplicateNotificationDeadline = addWorkingDays(submittedAt, commercialDuplicateDays)
    applyDuplicateClaimFields(payload, duplicateStatus, auth.userId)
    if (ownership.wasOverride) {
      pendingOwnershipOverride = {
        ownershipStartDate: ownership.ownershipStartDate,
        ownershipEndDate: ownership.ownershipEndDate,
      }
    }
  } else {
    payload.ownershipStartDate = dateFromKey(input.ownershipStartDate)
    payload.ownershipEndDate = dateFromKey(input.ownershipEndDate)
    if (input.ownershipStatus) payload.ownershipStatus = input.ownershipStatus
  }

  let created
  try {
    created = await CandidateSubmissionModel.create(payload)
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw AppError.conflict(MESSAGES.SUBMISSION_EXISTS)
    }
    throw error
  }

  await created.populate([...SUBMISSION_POPULATE])
  const publicSubmission = toPublicSubmission(created.toObject() as Record<string, unknown>)
  await recordActivity(auth.organizationId, {
    title: introducing
      ? `Candidate submitted to ${client.companyName}`
      : `Submission draft saved for ${client.companyName}`,
    detail: `${candidate.name || "Candidate"} · ${mandate.mandateNumber}`,
    tone: "success",
  })
  if (pendingOwnershipOverride) {
    await recordAudit(auth, {
      module: "SUBMISSIONS",
      action: "OVERRIDE",
      recordId: publicSubmission.id,
      newData: {
        ...pendingOwnershipOverride,
        ownershipOverridden: true,
      },
    })
  }
  if (introducing) {
    await recordAudit(auth, {
      module: "SUBMISSIONS",
      action: "SUBMITTED",
      recordId: publicSubmission.id,
      newData: publicSubmission,
    })
  }

  return publicSubmission
}

export async function updateSubmission(
  auth: AuthContext,
  id: string,
  input: UpdateSubmissionInput
) {
  const submission = await requireSubmission(auth.organizationId, id)
  const previousStatus = String(submission.status) as SubmissionStatus

  if (input.candidateId !== undefined) {
    const candidate = await assertCandidate(auth.organizationId, input.candidateId)
    submission.set("candidateId", candidate._id)
  }
  if (input.mandateId !== undefined) {
    const mandate = await assertMandate(auth.organizationId, input.mandateId)
    submission.set("mandateId", mandate._id)
    if (input.clientId === undefined) {
      submission.set("clientId", mandate.clientId)
    }
  }
  if (input.clientId !== undefined) {
    const client = await assertClient(auth.organizationId, input.clientId)
    submission.set("clientId", client._id)
  }

  const candidateId = asId(submission.candidateId)
  const mandateId = asId(submission.mandateId)
  const clientId = asId(submission.clientId)
  const mandate = await assertMandate(auth.organizationId, mandateId)
  if (String(mandate.clientId) !== clientId) {
    throw AppError.badRequest(MESSAGES.MANDATE_CLIENT_MISMATCH)
  }

  const candidate = await assertCandidate(auth.organizationId, candidateId)
  const nextStatus = (input.status ?? (submission.status as SubmissionStatus)) as SubmissionStatus
  const becomingIntroduced =
    isIntroducedSubmissionStatus(nextStatus) &&
    (!isIntroducedSubmissionStatus(previousStatus) || previousStatus === "DRAFT")
  const isIntroduced = isIntroducedSubmissionStatus(nextStatus)

  let commercialOwnershipMonths = 12
  let commercialDuplicateDays = 3

  if (isIntroduced) {
    const workflow = await assertSubmissionWorkflowReady({
      organizationId: auth.organizationId,
      candidateId,
      mandateId,
      clientId,
      evaluationId: input.evaluationId !== undefined ? input.evaluationId : asId(submission.evaluationId) || null,
      requireEvaluation: true,
    })
    if (workflow.evaluation && (!submission.evaluationId || input.evaluationId === undefined)) {
      if (!asId(submission.evaluationId)) {
        submission.set("evaluationId", workflow.evaluation._id)
      }
    }
    if (workflow.evaluation) {
      submission.evaluationScore = Number(workflow.evaluation.totalScore ?? 0)
    }
    commercialOwnershipMonths = workflow.commercial.ownershipPeriodMonths
    commercialDuplicateDays = workflow.commercial.duplicateNotificationDays

    const fitReasons =
      input.fitReasons !== undefined ? stringsOf(input.fitReasons) : stringsOf(submission.fitReasons)
    if (fitReasons.length < 1) {
      throw AppError.badRequest(MESSAGES.SUBMISSION_FIT_REASONS_REQUIRED)
    }
  }

  if (input.evaluationId !== undefined) {
    if (!input.evaluationId) {
      submission.set("evaluationId", null)
    } else {
      const evaluation = await assertEvaluation(
        auth.organizationId,
        input.evaluationId,
        candidateId,
        mandateId
      )
      submission.set("evaluationId", input.evaluationId)
      submission.evaluationScore = Number(evaluation.totalScore ?? 0)
    }
  } else if (submission.evaluationId && !isIntroduced) {
    await assertEvaluation(auth.organizationId, asId(submission.evaluationId), candidateId, mandateId)
  }

  if (input.submittedBy !== undefined) {
    await assertSubmitter(auth.organizationId, input.submittedBy)
    submission.set("submittedBy", input.submittedBy)
  }

  if (input.fitReasons !== undefined) submission.set("fitReasons", stringsOf(input.fitReasons))
  if (input.risksGaps !== undefined) submission.set("risksGaps", stringsOf(input.risksGaps))
  if (input.duplicateResolution !== undefined) {
    submission.duplicateResolution = input.duplicateResolution ?? ""
  }
  if (input.currentCompany !== undefined) submission.currentCompany = input.currentCompany ?? ""
  if (input.currentDesignation !== undefined) {
    submission.currentDesignation = input.currentDesignation ?? ""
  }
  if (input.currentLocation !== undefined) submission.currentLocation = input.currentLocation ?? ""
  if (input.totalExperience !== undefined) submission.totalExperience = input.totalExperience
  if (input.currentCTC !== undefined) submission.currentCTC = input.currentCTC
  if (input.expectedCTC !== undefined) submission.expectedCTC = input.expectedCTC
  if (input.noticePeriod !== undefined) submission.noticePeriod = input.noticePeriod ?? ""

  // Snapshot missing pack fields from candidate when introducing
  if (becomingIntroduced) {
    const snap = snapshotFromCandidate(candidate, {
      currentCompany: submission.currentCompany || undefined,
      currentDesignation: submission.currentDesignation || undefined,
      currentLocation: submission.currentLocation || undefined,
      totalExperience: submission.totalExperience ?? undefined,
      currentCTC: submission.currentCTC ?? undefined,
      expectedCTC: submission.expectedCTC ?? undefined,
      noticePeriod: submission.noticePeriod || undefined,
    })
    if (!submission.currentCompany) submission.currentCompany = snap.currentCompany
    if (!submission.currentDesignation) submission.currentDesignation = snap.currentDesignation
    if (!submission.currentLocation) submission.currentLocation = snap.currentLocation
    if (submission.totalExperience === null || submission.totalExperience === undefined) {
      submission.totalExperience = snap.totalExperience
    }
    if (submission.currentCTC === null || submission.currentCTC === undefined) {
      submission.currentCTC = snap.currentCTC
    }
    if (submission.expectedCTC === null || submission.expectedCTC === undefined) {
      submission.expectedCTC = snap.expectedCTC
    }
    if (!submission.noticePeriod) submission.noticePeriod = snap.noticePeriod
  }

  if (input.duplicateStatus !== undefined) submission.duplicateStatus = input.duplicateStatus
  if (input.duplicateEvidence !== undefined) {
    submission.duplicateEvidence = input.duplicateEvidence ?? ""
  }
  if (input.remarks !== undefined) submission.remarks = input.remarks ?? ""

  if (input.clientAcknowledgement !== undefined) {
    submission.clientAcknowledgement = input.clientAcknowledgement
    if (input.clientAcknowledgement && !submission.acknowledgementDate) {
      submission.acknowledgementDate = dateFromKey(input.acknowledgementDate) ?? new Date()
    }
    if (!input.clientAcknowledgement && input.acknowledgementDate === undefined) {
      submission.acknowledgementDate = null
    }
  }
  if (input.acknowledgementDate !== undefined) {
    submission.acknowledgementDate = dateFromKey(input.acknowledgementDate)
  }

  if (input.status !== undefined) submission.status = input.status
  if (input.submittedAt !== undefined) {
    submission.submittedAt = dateFromKey(input.submittedAt)
  } else if (!submission.submittedAt && nextStatus !== "DRAFT") {
    submission.submittedAt = new Date()
  }

  const duplicateStatus = String(submission.duplicateStatus ?? "NOT_CHECKED")

  if (isIntroduced && submission.submittedAt) {
    const hadOwnership = Boolean(submission.ownershipStartDate)
    if (!hadOwnership || becomingIntroduced || input.ownershipOverridden) {
      const ownership = await resolveOwnershipFields({
        organizationId: auth.organizationId,
        clientId,
        candidateId,
        submittedAt: submission.submittedAt,
        submittedBy: asId(submission.submittedBy) || auth.userId,
        ownershipPeriodMonths: commercialOwnershipMonths,
        existingStart: hadOwnership && !input.ownershipOverridden ? submission.ownershipStartDate : null,
        existingEnd: hadOwnership && !input.ownershipOverridden ? submission.ownershipEndDate : null,
        existingFirstIntroducedBy: submission.firstIntroducedBy,
        ownershipStartDate: input.ownershipStartDate,
        ownershipEndDate: input.ownershipEndDate,
        ownershipOverridden: input.ownershipOverridden,
        disputed: duplicateStatus === "DISPUTED",
      })
      if (!hadOwnership || ownership.wasOverride || becomingIntroduced) {
        submission.ownershipStartDate = ownership.ownershipStartDate
        submission.ownershipEndDate = ownership.ownershipEndDate
        submission.ownershipStatus = ownership.ownershipStatus
        submission.ownershipOverridden = ownership.ownershipOverridden
        if (!submission.firstIntroducedBy) {
          submission.set("firstIntroducedBy", ownership.firstIntroducedBy)
        }
      }
      if (ownership.wasOverride) {
        await recordAudit(auth, {
          module: "SUBMISSIONS",
          action: "OVERRIDE",
          recordId: id,
          newData: {
            ownershipStartDate: ownership.ownershipStartDate,
            ownershipEndDate: ownership.ownershipEndDate,
            ownershipOverridden: true,
          },
        })
      }
    } else if (input.ownershipStartDate !== undefined || input.ownershipEndDate !== undefined) {
      if (input.ownershipStartDate !== undefined) {
        submission.ownershipStartDate = dateFromKey(input.ownershipStartDate)
      }
      if (input.ownershipEndDate !== undefined) {
        submission.ownershipEndDate = dateFromKey(input.ownershipEndDate)
      }
      if (input.ownershipOverridden) submission.ownershipOverridden = true
      submission.ownershipStatus = resolveOwnershipStatus({
        ownershipStartDate: submission.ownershipStartDate,
        ownershipEndDate: submission.ownershipEndDate,
        disputed: duplicateStatus === "DISPUTED",
      })
    } else {
      submission.ownershipStatus = resolveOwnershipStatus({
        ownershipStartDate: submission.ownershipStartDate,
        ownershipEndDate: submission.ownershipEndDate,
        disputed: duplicateStatus === "DISPUTED",
      })
    }

    if (!submission.duplicateNotificationDeadline) {
      submission.duplicateNotificationDeadline = addWorkingDays(
        submission.submittedAt,
        commercialDuplicateDays
      )
    }
  } else {
    if (input.ownershipStartDate !== undefined) {
      submission.ownershipStartDate = dateFromKey(input.ownershipStartDate)
    }
    if (input.ownershipEndDate !== undefined) {
      submission.ownershipEndDate = dateFromKey(input.ownershipEndDate)
    }
    if (input.ownershipStatus !== undefined) submission.ownershipStatus = input.ownershipStatus
    if (input.ownershipOverridden !== undefined) {
      submission.ownershipOverridden = input.ownershipOverridden
    }
  }

  if (DUPLICATE_CLAIM_STATUSES.has(duplicateStatus)) {
    const claimPayload: Record<string, unknown> = {
      duplicateNotificationDeadline: submission.duplicateNotificationDeadline,
    }
    applyDuplicateClaimFields(
      claimPayload,
      duplicateStatus,
      auth.userId,
      submission.duplicateReportedAt ?? null
    )
    if (claimPayload.duplicateReportedAt !== undefined) {
      submission.duplicateReportedAt = claimPayload.duplicateReportedAt as Date
    }
    if (claimPayload.duplicateReportedBy !== undefined) {
      submission.set("duplicateReportedBy", claimPayload.duplicateReportedBy)
    }
    if (claimPayload.duplicateLateReport !== undefined) {
      submission.duplicateLateReport = Boolean(claimPayload.duplicateLateReport)
    }
  }

  if (isActiveSubmissionStatus(nextStatus)) {
    await assertNoActiveDuplicate(auth.organizationId, candidateId, mandateId, id)
  }

  try {
    await submission.save()
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw AppError.conflict(MESSAGES.SUBMISSION_EXISTS)
    }
    throw error
  }

  await submission.populate([...SUBMISSION_POPULATE])
  const publicSubmission = toPublicSubmission(submission.toObject() as Record<string, unknown>)

  if (becomingIntroduced) {
    await recordAudit(auth, {
      module: "SUBMISSIONS",
      action: "SUBMITTED",
      recordId: publicSubmission.id,
      previousData: { status: previousStatus },
      newData: publicSubmission,
    })
  }

  return publicSubmission
}

export async function deleteSubmission(auth: AuthContext, id: string) {
  parseObjectId(id)
  const hasInterviews = await InterviewModel.exists({
    organizationId: auth.organizationId,
    submissionId: id,
  })
  if (hasInterviews) {
    throw AppError.conflict(MESSAGES.SUBMISSION_HAS_INTERVIEWS)
  }

  const hasOffers = await OfferModel.exists({
    organizationId: auth.organizationId,
    submissionId: id,
  })
  if (hasOffers) {
    throw AppError.conflict(MESSAGES.SUBMISSION_HAS_OFFERS)
  }

  const deleted = await CandidateSubmissionModel.findOneAndDelete({
    _id: id,
    organizationId: auth.organizationId,
  })
  if (!deleted) {
    throw AppError.notFound(MESSAGES.SUBMISSION_NOT_FOUND)
  }
}
