import {
  INTERVIEW_DECISION_LABELS,
  INTERVIEW_FEEDBACK_FIELDS,
  INTERVIEW_STATUS_LABELS,
  INTERVIEW_TYPE_LABELS,
  normalizeInterviewDecision,
  type InterviewDecision,
  type InterviewFeedbackField,
  type InterviewStatus,
  type InterviewType,
} from "../constants/interviews.js"
import { MESSAGES } from "../constants/messages.js"
import { CandidateModel } from "../models/candidate.model.js"
import { CandidateSubmissionModel } from "../models/candidate-submission.model.js"
import { InterviewModel } from "../models/interview.model.js"
import { RecruitmentMandateModel } from "../models/recruitment-mandate.model.js"
import { UserModel } from "../models/user.model.js"
import type { AuthContext } from "../types/auth.js"
import { recordActivity } from "../utils/activity.js"
import { recordAudit } from "../utils/audit.js"
import { AppError } from "../utils/app-error.js"
import { utcDateFromKey } from "../utils/dates.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { applySearch, mongoSort, resolvedSearch } from "../utils/search.js"
import type {
  CreateInterviewInput,
  InterviewListQueryInput,
  UpdateInterviewInput,
} from "../validators/interview.validators.js"

const INTERVIEW_POPULATE = [
  { path: "candidateId", select: "firstName lastName name email candidateNumber" },
  { path: "mandateId", select: "mandateNumber position status" },
  { path: "submissionId", select: "status submittedAt" },
  { path: "interviewers", select: "name email role" },
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

function isDuplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000
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

function toSubmissionRef(value: unknown) {
  if (!value) return null
  if (typeof value === "object" && value !== null && ("status" in value || "_id" in value)) {
    const submission = value as { _id: unknown; status?: string; submittedAt?: unknown }
    return {
      id: String(submission._id),
      status: String(submission.status ?? ""),
    }
  }
  return { id: String(value), status: "" }
}

function feedbackOf(value: unknown) {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    technicalScore: Number(source.technicalScore ?? 0),
    communicationScore: Number(source.communicationScore ?? 0),
    cultureFitScore: Number(source.cultureFitScore ?? 0),
    leadershipScore: Number(source.leadershipScore ?? 0),
    compensationFit: Number(source.compensationFit ?? 0),
    joiningRisk: Number(source.joiningRisk ?? 0),
    comments: String(source.comments ?? ""),
  }
}

function parseDateTime(value: string, label = "Invalid date and time") {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw AppError.badRequest(label)
  }
  return date
}

export function toPublicInterview(doc: Record<string, unknown>) {
  const candidate = toCandidateRef(doc.candidateId)
  const mandate = toMandateRef(doc.mandateId)
  const submission = toSubmissionRef(doc.submissionId)
  const interviewType = (String(doc.interviewType ?? "VIDEO") as InterviewType) || "VIDEO"
  const status = (String(doc.status ?? "SCHEDULED") as InterviewStatus) || "SCHEDULED"
  const decisionRaw = normalizeInterviewDecision(String(doc.decision ?? ""))
  const decision = (decisionRaw as InterviewDecision) || ""
  const interviewers = Array.isArray(doc.interviewers)
    ? doc.interviewers.map(toUserRef).filter((user): user is NonNullable<typeof user> => user !== null)
    : []

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    candidateId: candidate?.id ?? asId(doc.candidateId),
    candidate,
    mandateId: mandate?.id ?? asId(doc.mandateId),
    mandate,
    submissionId: submission?.id ?? asId(doc.submissionId),
    submission,
    round: Number(doc.round ?? 1),
    interviewType,
    interviewTypeLabel: INTERVIEW_TYPE_LABELS[interviewType] ?? interviewType,
    scheduledAt: isoOf(doc.scheduledAt),
    duration: Number(doc.duration ?? 60),
    interviewers,
    interviewerIds: interviewers.map((user) => user.id),
    status,
    statusLabel: INTERVIEW_STATUS_LABELS[status] ?? status,
    feedback: feedbackOf(doc.feedback),
    decision,
    decisionLabel: decision
      ? (INTERVIEW_DECISION_LABELS[decision as InterviewDecision] ?? decision)
      : "",
    nextAction: String(doc.nextAction ?? ""),
    nextActionDeadline: dateKeyOf(doc.nextActionDeadline),
    createdAt: isoOf(doc.createdAt),
    updatedAt: isoOf(doc.updatedAt),
  }
}

async function requireInterview(organizationId: string, id: string) {
  parseObjectId(id)
  const interview = await InterviewModel.findOne({ _id: id, organizationId }).populate([
    ...INTERVIEW_POPULATE,
  ])
  if (!interview) {
    throw AppError.notFound(MESSAGES.INTERVIEW_NOT_FOUND)
  }
  return interview
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

async function assertSubmission(organizationId: string, submissionId: string) {
  parseObjectId(submissionId, "Invalid submission")
  const submission = await CandidateSubmissionModel.findOne({
    _id: submissionId,
    organizationId,
  }).select("_id candidateId mandateId status")
  if (!submission) {
    throw AppError.badRequest(MESSAGES.SUBMISSION_NOT_FOUND)
  }
  return submission
}

async function assertInterviewers(organizationId: string, interviewerIds?: string[]) {
  if (!interviewerIds?.length) return []
  const uniqueIds = [...new Set(interviewerIds)]
  uniqueIds.forEach((id) => parseObjectId(id, "Invalid interviewer"))
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

async function assertNoRoundConflict(
  organizationId: string,
  submissionId: string,
  round: number,
  excludeId?: string
) {
  const existing = await InterviewModel.findOne({
    organizationId,
    submissionId,
    round,
    status: { $ne: "CANCELLED" },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select("_id")
  if (existing) {
    throw AppError.conflict(MESSAGES.INTERVIEW_ROUND_EXISTS)
  }
}

async function syncSubmissionFromInterviewDecision(
  organizationId: string,
  submissionId: string,
  status: InterviewStatus,
  decision: string
) {
  if (status !== "COMPLETED") return
  const normalized = normalizeInterviewDecision(decision)
  let nextSubmissionStatus: string | null = null
  if (normalized === "SELECTED") nextSubmissionStatus = "SHORTLISTED"
  else if (normalized === "NEXT_ROUND") nextSubmissionStatus = "UNDER_REVIEW"
  else if (normalized === "REJECTED") nextSubmissionStatus = "REJECTED"
  else if (normalized === "ON_HOLD") nextSubmissionStatus = "UNDER_REVIEW"
  if (!nextSubmissionStatus) return

  await CandidateSubmissionModel.updateOne(
    { _id: submissionId, organizationId },
    { $set: { status: nextSubmissionStatus } }
  )
}

function mergeFeedback(
  current: ReturnType<typeof feedbackOf>,
  patch?: UpdateInterviewInput["feedback"]
) {
  if (!patch) return current
  const next = { ...current }
  for (const field of INTERVIEW_FEEDBACK_FIELDS) {
    const value = patch[field as InterviewFeedbackField]
    if (value !== undefined) next[field] = value
  }
  if (patch.comments !== undefined) next.comments = patch.comments ?? ""
  return next
}

export async function listInterviews(auth: AuthContext, query: InterviewListQueryInput) {
  const filter: Record<string, unknown> = { organizationId: auth.organizationId }

  if (query.candidateId) {
    parseObjectId(query.candidateId, "Invalid candidate")
    filter.candidateId = query.candidateId
  }
  if (query.mandateId) {
    parseObjectId(query.mandateId, "Invalid mandate")
    filter.mandateId = query.mandateId
  }
  if (query.submissionId) {
    parseObjectId(query.submissionId, "Invalid submission")
    filter.submissionId = query.submissionId
  }
  if (query.status) filter.status = query.status
  if (query.interviewType) filter.interviewType = query.interviewType

  applySearch(filter, ["decision", "nextAction"], resolvedSearch(query))

  const [items, total] = await Promise.all([
    InterviewModel.find(filter)
      .populate([...INTERVIEW_POPULATE])
      .sort(mongoSort(query, { scheduledAt: -1, createdAt: -1 }))
      .skip(paginationSkip(query))
      .limit(query.limit)
      .lean(),
    InterviewModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicInterview(item as Record<string, unknown>)),
    ...paginationMeta(total, query),
  }
}

export async function getInterview(auth: AuthContext, id: string) {
  const interview = await requireInterview(auth.organizationId, id)
  return toPublicInterview(interview.toObject() as Record<string, unknown>)
}

export async function createInterview(auth: AuthContext, input: CreateInterviewInput) {
  const submission = await assertSubmission(auth.organizationId, input.submissionId)
  const candidateId = input.candidateId ?? String(submission.candidateId)
  const mandateId = input.mandateId ?? String(submission.mandateId)

  if (String(submission.candidateId) !== candidateId) {
    throw AppError.badRequest(MESSAGES.SUBMISSION_CANDIDATE_MISMATCH)
  }
  if (String(submission.mandateId) !== mandateId) {
    throw AppError.badRequest(MESSAGES.SUBMISSION_MANDATE_MISMATCH)
  }

  const candidate = await assertCandidate(auth.organizationId, candidateId)
  const mandate = await assertMandate(auth.organizationId, mandateId)
  const interviewers = await assertInterviewers(auth.organizationId, input.interviewers)
  const round = input.round ?? 1
  const status = input.status ?? "SCHEDULED"

  if (status !== "CANCELLED") {
    await assertNoRoundConflict(auth.organizationId, String(submission._id), round)
  }

  let created
  try {
    created = await InterviewModel.create({
      organizationId: auth.organizationId,
      candidateId: candidate._id,
      mandateId: mandate._id,
      submissionId: submission._id,
      round,
      interviewType: input.interviewType ?? "VIDEO",
      scheduledAt: parseDateTime(input.scheduledAt),
      duration: input.duration ?? 60,
      interviewers,
      status,
      feedback: mergeFeedback(feedbackOf(null), input.feedback),
      decision: normalizeInterviewDecision(input.decision ?? "") || input.decision || "",
      nextAction: input.nextAction ?? "",
      nextActionDeadline: input.nextActionDeadline
        ? utcDateFromKey(input.nextActionDeadline)
        : null,
    })
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw AppError.conflict(MESSAGES.INTERVIEW_ROUND_EXISTS)
    }
    throw error
  }

  await syncSubmissionFromInterviewDecision(
    auth.organizationId,
    String(submission._id),
    status,
    String(created.decision ?? "")
  )

  await created.populate([...INTERVIEW_POPULATE])
  await recordActivity(auth.organizationId, {
    title: `Interview scheduled for ${candidate.name || "candidate"}`,
    detail: `${mandate.mandateNumber} · Round ${round}`,
    tone: "success",
  })

  return toPublicInterview(created.toObject() as Record<string, unknown>)
}

export async function updateInterview(auth: AuthContext, id: string, input: UpdateInterviewInput) {
  const interview = await requireInterview(auth.organizationId, id)
  const previousData = toPublicInterview(interview.toObject() as Record<string, unknown>)

  if (input.submissionId !== undefined) {
    const submission = await assertSubmission(auth.organizationId, input.submissionId)
    interview.set("submissionId", submission._id)
    if (input.candidateId === undefined) interview.set("candidateId", submission.candidateId)
    if (input.mandateId === undefined) interview.set("mandateId", submission.mandateId)
  }
  if (input.candidateId !== undefined) {
    const candidate = await assertCandidate(auth.organizationId, input.candidateId)
    interview.set("candidateId", candidate._id)
  }
  if (input.mandateId !== undefined) {
    const mandate = await assertMandate(auth.organizationId, input.mandateId)
    interview.set("mandateId", mandate._id)
  }

  const submission = await assertSubmission(auth.organizationId, asId(interview.submissionId))
  if (String(submission.candidateId) !== asId(interview.candidateId)) {
    throw AppError.badRequest(MESSAGES.SUBMISSION_CANDIDATE_MISMATCH)
  }
  if (String(submission.mandateId) !== asId(interview.mandateId)) {
    throw AppError.badRequest(MESSAGES.SUBMISSION_MANDATE_MISMATCH)
  }

  if (input.round !== undefined) interview.round = input.round
  if (input.interviewType !== undefined) interview.interviewType = input.interviewType
  if (input.scheduledAt !== undefined) interview.scheduledAt = parseDateTime(input.scheduledAt)
  if (input.duration !== undefined) interview.duration = input.duration
  if (input.interviewers !== undefined) {
    interview.set("interviewers", await assertInterviewers(auth.organizationId, input.interviewers))
  }
  if (input.status !== undefined) interview.status = input.status
  if (input.feedback !== undefined) {
    interview.set("feedback", mergeFeedback(feedbackOf(interview.feedback), input.feedback))
  }
  if (input.decision !== undefined) {
    interview.decision = normalizeInterviewDecision(input.decision) || input.decision || ""
  }
  if (input.nextAction !== undefined) interview.nextAction = input.nextAction ?? ""
  if (input.nextActionDeadline !== undefined) {
    interview.nextActionDeadline = input.nextActionDeadline
      ? utcDateFromKey(input.nextActionDeadline)
      : null
  }

  const nextStatus = (interview.status as InterviewStatus) || "SCHEDULED"
  if (nextStatus !== "CANCELLED") {
    await assertNoRoundConflict(
      auth.organizationId,
      asId(interview.submissionId),
      Number(interview.round ?? 1),
      id
    )
  }

  try {
    await interview.save()
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw AppError.conflict(MESSAGES.INTERVIEW_ROUND_EXISTS)
    }
    throw error
  }

  await syncSubmissionFromInterviewDecision(
    auth.organizationId,
    asId(interview.submissionId),
    nextStatus,
    String(interview.decision ?? "")
  )

  await interview.populate([...INTERVIEW_POPULATE])
  const publicInterview = toPublicInterview(interview.toObject() as Record<string, unknown>)
  await recordAudit(auth, {
    module: "INTERVIEWS",
    action: "UPDATED",
    recordId: publicInterview.id,
    previousData,
    newData: publicInterview,
  })
  return publicInterview
}

export async function deleteInterview(auth: AuthContext, id: string) {
  parseObjectId(id)
  const deleted = await InterviewModel.findOneAndDelete({
    _id: id,
    organizationId: auth.organizationId,
  })
  if (!deleted) {
    throw AppError.notFound(MESSAGES.INTERVIEW_NOT_FOUND)
  }
}
