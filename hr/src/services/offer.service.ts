import {
  isActiveOfferStatus,
  JOINING_STATUS_LABELS,
  OFFER_ACTIVE_STATUSES,
  OFFER_STATUS_LABELS,
  type JoiningStatus,
  type OfferStatus,
} from "../constants/offers.js"
import { MESSAGES } from "../constants/messages.js"
import { CandidateModel } from "../models/candidate.model.js"
import { CandidateSubmissionModel } from "../models/candidate-submission.model.js"
import { OfferModel } from "../models/offer.model.js"
import { JoiningModel } from "../models/joining.model.js"
import { PreJoiningFollowUpModel } from "../models/pre-joining-follow-up.model.js"
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
  CreateOfferInput,
  OfferListQueryInput,
  UpdateOfferInput,
} from "../validators/offer.validators.js"

const OFFER_POPULATE = [
  { path: "candidateId", select: "firstName lastName name email candidateNumber" },
  { path: "mandateId", select: "mandateNumber position status" },
  { path: "submissionId", select: "status submittedAt" },
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
    const submission = value as { _id: unknown; status?: string }
    return { id: String(submission._id), status: String(submission.status ?? "") }
  }
  return { id: String(value), status: "" }
}

export function toPublicOffer(doc: Record<string, unknown>) {
  const candidate = toCandidateRef(doc.candidateId)
  const mandate = toMandateRef(doc.mandateId)
  const submission = toSubmissionRef(doc.submissionId)
  const offerStatus = (String(doc.offerStatus ?? "DRAFT") as OfferStatus) || "DRAFT"
  const joiningStatus = (String(doc.joiningStatus ?? "PENDING") as JoiningStatus) || "PENDING"

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    candidateId: candidate?.id ?? asId(doc.candidateId),
    candidate,
    mandateId: mandate?.id ?? asId(doc.mandateId),
    mandate,
    submissionId: submission?.id ?? asId(doc.submissionId),
    submission,
    selectedDate: dateKeyOf(doc.selectedDate),
    offeredDesignation: String(doc.offeredDesignation ?? ""),
    offeredCTC: Number(doc.offeredCTC ?? 0),
    offerDate: dateKeyOf(doc.offerDate),
    offerStatus,
    offerStatusLabel: OFFER_STATUS_LABELS[offerStatus] ?? offerStatus,
    expectedJoiningDate: dateKeyOf(doc.expectedJoiningDate),
    actualJoiningDate: dateKeyOf(doc.actualJoiningDate),
    joiningStatus,
    joiningStatusLabel: JOINING_STATUS_LABELS[joiningStatus] ?? joiningStatus,
    remarks: String(doc.remarks ?? ""),
    createdAt: isoOf(doc.createdAt),
    updatedAt: isoOf(doc.updatedAt),
  }
}

async function requireOffer(organizationId: string, id: string) {
  parseObjectId(id)
  const offer = await OfferModel.findOne({ _id: id, organizationId }).populate([...OFFER_POPULATE])
  if (!offer) {
    throw AppError.notFound(MESSAGES.OFFER_NOT_FOUND)
  }
  return offer
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

async function assertNoActiveOffer(
  organizationId: string,
  submissionId: string,
  excludeId?: string
) {
  const existing = await OfferModel.findOne({
    organizationId,
    submissionId,
    offerStatus: { $in: [...OFFER_ACTIVE_STATUSES] },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select("_id")
  if (existing) {
    throw AppError.conflict(MESSAGES.OFFER_EXISTS)
  }
}

function offerDateFor(status: OfferStatus, explicit?: string | null, current?: Date | null) {
  if (explicit) return dateFromKey(explicit)
  if (status === "DRAFT") return current ?? null
  return current ?? new Date()
}

export async function listOffers(auth: AuthContext, query: OfferListQueryInput) {
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
  if (query.offerStatus) filter.offerStatus = query.offerStatus
  if (query.joiningStatus) filter.joiningStatus = query.joiningStatus

  applySearch(filter, ["offeredDesignation", "remarks"], resolvedSearch(query))

  const [items, total] = await Promise.all([
    OfferModel.find(filter)
      .populate([...OFFER_POPULATE])
      .sort(mongoSort(query, { offerDate: -1, createdAt: -1 }))
      .skip(paginationSkip(query))
      .limit(query.limit)
      .lean(),
    OfferModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicOffer(item as Record<string, unknown>)),
    ...paginationMeta(total, query),
  }
}

export async function getOffer(auth: AuthContext, id: string) {
  const offer = await requireOffer(auth.organizationId, id)
  return toPublicOffer(offer.toObject() as Record<string, unknown>)
}

export async function createOffer(auth: AuthContext, input: CreateOfferInput) {
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
  const offerStatus = input.offerStatus ?? "DRAFT"
  const joiningStatus = input.joiningStatus ?? "PENDING"

  if (isActiveOfferStatus(offerStatus)) {
    await assertNoActiveOffer(auth.organizationId, String(submission._id))
  }

  let created
  try {
    created = await OfferModel.create({
      organizationId: auth.organizationId,
      candidateId: candidate._id,
      mandateId: mandate._id,
      submissionId: submission._id,
      selectedDate: dateFromKey(input.selectedDate) ?? new Date(),
      offeredDesignation: input.offeredDesignation,
      offeredCTC: input.offeredCTC,
      offerDate: offerDateFor(offerStatus, input.offerDate),
      offerStatus,
      expectedJoiningDate: dateFromKey(input.expectedJoiningDate),
      actualJoiningDate:
        dateFromKey(input.actualJoiningDate) ?? (joiningStatus === "JOINED" ? new Date() : null),
      joiningStatus,
      remarks: input.remarks ?? "",
    })
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw AppError.conflict(MESSAGES.OFFER_EXISTS)
    }
    throw error
  }

  await created.populate([...OFFER_POPULATE])
  const publicOffer = toPublicOffer(created.toObject() as Record<string, unknown>)
  await recordActivity(auth.organizationId, {
    title: `Offer recorded for ${candidate.name || "candidate"}`,
    detail: `${mandate.mandateNumber} · ${created.offeredDesignation}`,
    tone: "success",
  })
  if (offerStatus === "ACCEPTED") {
    await recordAudit(auth, {
      module: "OFFERS",
      action: "ACCEPTED",
      recordId: publicOffer.id,
      newData: publicOffer,
    })
  }

  return publicOffer
}

export async function updateOffer(auth: AuthContext, id: string, input: UpdateOfferInput) {
  const offer = await requireOffer(auth.organizationId, id)
  const previousStatus = String(offer.offerStatus)

  if (input.submissionId !== undefined) {
    const submission = await assertSubmission(auth.organizationId, input.submissionId)
    offer.set("submissionId", submission._id)
    if (input.candidateId === undefined) offer.set("candidateId", submission.candidateId)
    if (input.mandateId === undefined) offer.set("mandateId", submission.mandateId)
  }
  if (input.candidateId !== undefined) {
    const candidate = await assertCandidate(auth.organizationId, input.candidateId)
    offer.set("candidateId", candidate._id)
  }
  if (input.mandateId !== undefined) {
    const mandate = await assertMandate(auth.organizationId, input.mandateId)
    offer.set("mandateId", mandate._id)
  }

  const submission = await assertSubmission(auth.organizationId, asId(offer.submissionId))
  if (String(submission.candidateId) !== asId(offer.candidateId)) {
    throw AppError.badRequest(MESSAGES.SUBMISSION_CANDIDATE_MISMATCH)
  }
  if (String(submission.mandateId) !== asId(offer.mandateId)) {
    throw AppError.badRequest(MESSAGES.SUBMISSION_MANDATE_MISMATCH)
  }

  if (input.selectedDate !== undefined) offer.selectedDate = dateFromKey(input.selectedDate)
  if (input.offeredDesignation !== undefined) offer.offeredDesignation = input.offeredDesignation
  if (input.offeredCTC !== undefined) offer.offeredCTC = input.offeredCTC
  if (input.expectedJoiningDate !== undefined) {
    offer.expectedJoiningDate = dateFromKey(input.expectedJoiningDate)
  }
  if (input.actualJoiningDate !== undefined) {
    offer.actualJoiningDate = dateFromKey(input.actualJoiningDate)
  }
  if (input.remarks !== undefined) offer.remarks = input.remarks ?? ""

  const nextStatus = input.offerStatus ?? (offer.offerStatus as OfferStatus)
  if (input.offerStatus !== undefined) offer.offerStatus = input.offerStatus
  if (input.offerDate !== undefined) {
    offer.offerDate = dateFromKey(input.offerDate)
  } else if (!offer.offerDate && nextStatus !== "DRAFT") {
    offer.offerDate = new Date()
  }

  const nextJoining = input.joiningStatus ?? (offer.joiningStatus as JoiningStatus)
  if (input.joiningStatus !== undefined) offer.joiningStatus = input.joiningStatus
  if (!offer.actualJoiningDate && nextJoining === "JOINED") {
    offer.actualJoiningDate = new Date()
  }

  if (isActiveOfferStatus(nextStatus)) {
    await assertNoActiveOffer(auth.organizationId, asId(offer.submissionId), id)
  }

  try {
    await offer.save()
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw AppError.conflict(MESSAGES.OFFER_EXISTS)
    }
    throw error
  }

  await offer.populate([...OFFER_POPULATE])
  const publicOffer = toPublicOffer(offer.toObject() as Record<string, unknown>)
  if (publicOffer.offerStatus === "ACCEPTED" && previousStatus !== "ACCEPTED") {
    await recordAudit(auth, {
      module: "OFFERS",
      action: "ACCEPTED",
      recordId: publicOffer.id,
      previousData: { offerStatus: previousStatus },
      newData: publicOffer,
    })
  }
  return publicOffer
}

export async function deleteOffer(auth: AuthContext, id: string) {
  parseObjectId(id)
  const hasFollowUps = await PreJoiningFollowUpModel.exists({
    organizationId: auth.organizationId,
    offerId: id,
  })
  if (hasFollowUps) {
    throw AppError.conflict(MESSAGES.OFFER_HAS_FOLLOW_UPS)
  }

  const hasJoinings = await JoiningModel.exists({
    organizationId: auth.organizationId,
    offerId: id,
  })
  if (hasJoinings) {
    throw AppError.conflict(MESSAGES.OFFER_HAS_JOININGS)
  }

  const deleted = await OfferModel.findOneAndDelete({
    _id: id,
    organizationId: auth.organizationId,
  })
  if (!deleted) {
    throw AppError.notFound(MESSAGES.OFFER_NOT_FOUND)
  }
}
