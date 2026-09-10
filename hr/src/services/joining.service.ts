import {
  isConfirmedJoiningStatus,
  JOINING_CONFIRMATION_STATUS_LABELS,
  type JoiningConfirmationStatus,
} from "../constants/joinings.js"
import { MESSAGES } from "../constants/messages.js"
import { CandidateModel } from "../models/candidate.model.js"
import { ClientModel } from "../models/client.model.js"
import { GuaranteeFollowUpModel } from "../models/guarantee-follow-up.model.js"
import { InvoiceModel } from "../models/invoice.model.js"
import { ReplacementCaseModel } from "../models/replacement-case.model.js"
import { JoiningModel } from "../models/joining.model.js"
import { OfferModel } from "../models/offer.model.js"
import { RecruitmentMandateModel } from "../models/recruitment-mandate.model.js"
import { UserModel } from "../models/user.model.js"
import type { AuthContext } from "../types/auth.js"
import { recordActivity } from "../utils/activity.js"
import { recordAudit } from "../utils/audit.js"
import { AppError } from "../utils/app-error.js"
import { utcDateFromKey } from "../utils/dates.js"
import { ensureJoiningSideEffects } from "../utils/joining-side-effects.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { applySearch, mongoSort, resolvedSearch } from "../utils/search.js"
import type {
  CreateJoiningInput,
  JoiningListQueryInput,
  UpdateJoiningInput,
} from "../validators/joining.validators.js"

const JOINING_POPULATE = [
  { path: "candidateId", select: "firstName lastName name email candidateNumber" },
  { path: "mandateId", select: "mandateNumber position status" },
  { path: "offerId", select: "offeredDesignation offerStatus expectedJoiningDate joiningStatus" },
  { path: "clientId", select: "companyName" },
  { path: "confirmedBy", select: "name email role" },
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

function toOfferRef(value: unknown) {
  if (!value) return null
  if (typeof value === "object" && value !== null && ("offeredDesignation" in value || "_id" in value)) {
    const offer = value as {
      _id: unknown
      offeredDesignation?: string
      offerStatus?: string
      expectedJoiningDate?: unknown
      joiningStatus?: string
    }
    return {
      id: String(offer._id),
      offeredDesignation: offer.offeredDesignation ?? "",
      offerStatus: offer.offerStatus ?? "",
      expectedJoiningDate: dateKeyOf(offer.expectedJoiningDate),
      joiningStatus: offer.joiningStatus ?? "",
    }
  }
  return {
    id: String(value),
    offeredDesignation: "",
    offerStatus: "",
    expectedJoiningDate: "",
    joiningStatus: "",
  }
}

function toClientRef(value: unknown) {
  if (!value) return null
  if (typeof value === "object" && value !== null && ("companyName" in value || "_id" in value)) {
    const client = value as { _id: unknown; companyName?: string }
    return {
      id: String(client._id),
      companyName: client.companyName ?? "",
    }
  }
  return { id: String(value), companyName: "" }
}

export function toPublicJoining(doc: Record<string, unknown>) {
  const candidate = toCandidateRef(doc.candidateId)
  const mandate = toMandateRef(doc.mandateId)
  const offer = toOfferRef(doc.offerId)
  const client = toClientRef(doc.clientId)
  const confirmedBy = toUserRef(doc.confirmedBy)
  const status = (String(doc.status ?? "EXPECTED") as JoiningConfirmationStatus) || "EXPECTED"

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    candidateId: candidate?.id ?? asId(doc.candidateId),
    candidate,
    mandateId: mandate?.id ?? asId(doc.mandateId),
    mandate,
    offerId: offer?.id ?? asId(doc.offerId),
    offer,
    clientId: client?.id ?? asId(doc.clientId),
    client,
    joiningDate: dateKeyOf(doc.joiningDate),
    status,
    statusLabel: JOINING_CONFIRMATION_STATUS_LABELS[status] ?? status,
    confirmedById: confirmedBy?.id ?? asId(doc.confirmedBy),
    confirmedBy,
    confirmationDate: dateKeyOf(doc.confirmationDate),
    remarks: String(doc.remarks ?? ""),
    createdAt: isoOf(doc.createdAt),
    updatedAt: isoOf(doc.updatedAt),
  }
}

async function requireJoining(organizationId: string, id: string) {
  parseObjectId(id)
  const joining = await JoiningModel.findOne({ _id: id, organizationId }).populate([
    ...JOINING_POPULATE,
  ])
  if (!joining) {
    throw AppError.notFound(MESSAGES.JOINING_NOT_FOUND)
  }
  return joining
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
    "_id clientId mandateNumber position status"
  )
  if (!mandate) {
    throw AppError.badRequest(MESSAGES.MANDATE_NOT_FOUND)
  }
  return mandate
}

async function assertOffer(organizationId: string, offerId: string) {
  parseObjectId(offerId, "Invalid offer")
  const offer = await OfferModel.findOne({ _id: offerId, organizationId }).select(
    "_id candidateId mandateId offeredDesignation expectedJoiningDate"
  )
  if (!offer) {
    throw AppError.badRequest(MESSAGES.OFFER_NOT_FOUND)
  }
  return offer
}

async function assertClient(organizationId: string, clientId: string) {
  parseObjectId(clientId, "Invalid client")
  const client = await ClientModel.findOne({ _id: clientId, organizationId }).select("_id companyName")
  if (!client) {
    throw AppError.badRequest(MESSAGES.CLIENT_NOT_IN_ORGANIZATION)
  }
  return client
}

async function assertConfirmer(organizationId: string, userId: string) {
  parseObjectId(userId, "Invalid user")
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

async function assertNoJoining(organizationId: string, offerId: string, excludeId?: string) {
  const existing = await JoiningModel.findOne({
    organizationId,
    offerId,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select("_id")
  if (existing) {
    throw AppError.conflict(MESSAGES.JOINING_EXISTS)
  }
}

function resolveConfirmation(
  status: JoiningConfirmationStatus,
  authUserId: string,
  confirmedBy?: string,
  confirmationDate?: string | null
) {
  const needsConfirmation = isConfirmedJoiningStatus(status)
  const nextConfirmedBy = confirmedBy ?? (needsConfirmation ? authUserId : undefined)
  const nextConfirmationDate =
    confirmationDate ?? (nextConfirmedBy || needsConfirmation ? dateKeyOf(new Date()) : undefined)

  return {
    confirmedBy: nextConfirmedBy ?? null,
    confirmationDate: dateFromKey(nextConfirmationDate),
  }
}

export async function listJoinings(auth: AuthContext, query: JoiningListQueryInput) {
  const filter: Record<string, unknown> = { organizationId: auth.organizationId }

  if (query.candidateId) {
    parseObjectId(query.candidateId, "Invalid candidate")
    filter.candidateId = query.candidateId
  }
  if (query.mandateId) {
    parseObjectId(query.mandateId, "Invalid mandate")
    filter.mandateId = query.mandateId
  }
  if (query.offerId) {
    parseObjectId(query.offerId, "Invalid offer")
    filter.offerId = query.offerId
  }
  if (query.clientId) {
    parseObjectId(query.clientId, "Invalid client")
    filter.clientId = query.clientId
  }
  if (query.status) filter.status = query.status

  applySearch(filter, ["remarks"], resolvedSearch(query))

  const [items, total] = await Promise.all([
    JoiningModel.find(filter)
      .populate([...JOINING_POPULATE])
      .sort(mongoSort(query, { joiningDate: -1, createdAt: -1 }))
      .skip(paginationSkip(query))
      .limit(query.limit)
      .lean(),
    JoiningModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicJoining(item as Record<string, unknown>)),
    ...paginationMeta(total, query),
  }
}

export async function getJoining(auth: AuthContext, id: string) {
  const joining = await requireJoining(auth.organizationId, id)
  return toPublicJoining(joining.toObject() as Record<string, unknown>)
}

export async function createJoining(auth: AuthContext, input: CreateJoiningInput) {
  const offer = await assertOffer(auth.organizationId, input.offerId)
  const candidateId = input.candidateId ?? String(offer.candidateId)
  const mandateId = input.mandateId ?? String(offer.mandateId)

  if (String(offer.candidateId) !== candidateId) {
    throw AppError.badRequest(MESSAGES.OFFER_CANDIDATE_MISMATCH)
  }
  if (String(offer.mandateId) !== mandateId) {
    throw AppError.badRequest(MESSAGES.OFFER_MANDATE_MISMATCH)
  }

  const candidate = await assertCandidate(auth.organizationId, candidateId)
  const mandate = await assertMandate(auth.organizationId, mandateId)
  const clientId = input.clientId ?? String(mandate.clientId)

  if (String(mandate.clientId) !== clientId) {
    throw AppError.badRequest(MESSAGES.MANDATE_CLIENT_MISMATCH)
  }

  const client = await assertClient(auth.organizationId, clientId)
  const status = input.status ?? "EXPECTED"
  const confirmation = resolveConfirmation(
    status,
    auth.userId,
    input.confirmedBy,
    input.confirmationDate
  )

  if (confirmation.confirmedBy) {
    await assertConfirmer(auth.organizationId, confirmation.confirmedBy)
  }

  await assertNoJoining(auth.organizationId, String(offer._id))

  let created
  try {
    created = await JoiningModel.create({
      organizationId: auth.organizationId,
      candidateId: candidate._id,
      mandateId: mandate._id,
      offerId: offer._id,
      clientId: client._id,
      joiningDate:
        dateFromKey(input.joiningDate) ?? dateFromKey(dateKeyOf(offer.expectedJoiningDate)) ?? new Date(),
      status,
      confirmedBy: confirmation.confirmedBy,
      confirmationDate: confirmation.confirmationDate,
      remarks: input.remarks ?? "",
    })
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw AppError.conflict(MESSAGES.JOINING_EXISTS)
    }
    throw error
  }

  await created.populate([...JOINING_POPULATE])
  const publicJoining = toPublicJoining(created.toObject() as Record<string, unknown>)
  await recordActivity(auth.organizationId, {
    title: `Joining recorded for ${candidate.name || "candidate"}`,
    detail: `${mandate.mandateNumber} · ${status}`,
    tone: "success",
  })
  if (isConfirmedJoiningStatus(status)) {
    await ensureJoiningSideEffects(auth, {
      _id: created._id,
      organizationId: created.organizationId,
      clientId: created.clientId,
      candidateId: created.candidateId,
      mandateId: created.mandateId,
      offerId: created.offerId,
      joiningDate: created.joiningDate,
    })
    await recordAudit(auth, {
      module: "JOININGS",
      action: "JOINED",
      recordId: publicJoining.id,
      newData: publicJoining,
    })
  }

  return publicJoining
}

export async function updateJoining(auth: AuthContext, id: string, input: UpdateJoiningInput) {
  const joining = await requireJoining(auth.organizationId, id)
  const previousStatus = String(joining.status)

  if (input.offerId !== undefined) {
    const offer = await assertOffer(auth.organizationId, input.offerId)
    joining.set("offerId", offer._id)
    if (input.candidateId === undefined) joining.set("candidateId", offer.candidateId)
    if (input.mandateId === undefined) joining.set("mandateId", offer.mandateId)
  }
  if (input.candidateId !== undefined) {
    const candidate = await assertCandidate(auth.organizationId, input.candidateId)
    joining.set("candidateId", candidate._id)
  }
  if (input.mandateId !== undefined) {
    const mandate = await assertMandate(auth.organizationId, input.mandateId)
    joining.set("mandateId", mandate._id)
    if (input.clientId === undefined) joining.set("clientId", mandate.clientId)
  }
  if (input.clientId !== undefined) {
    const client = await assertClient(auth.organizationId, input.clientId)
    joining.set("clientId", client._id)
  }

  const offer = await assertOffer(auth.organizationId, asId(joining.offerId))
  if (String(offer.candidateId) !== asId(joining.candidateId)) {
    throw AppError.badRequest(MESSAGES.OFFER_CANDIDATE_MISMATCH)
  }
  if (String(offer.mandateId) !== asId(joining.mandateId)) {
    throw AppError.badRequest(MESSAGES.OFFER_MANDATE_MISMATCH)
  }

  const mandate = await assertMandate(auth.organizationId, asId(joining.mandateId))
  if (String(mandate.clientId) !== asId(joining.clientId)) {
    throw AppError.badRequest(MESSAGES.MANDATE_CLIENT_MISMATCH)
  }

  if (input.joiningDate !== undefined) {
    joining.joiningDate = dateFromKey(input.joiningDate) ?? joining.joiningDate
  }
  if (input.remarks !== undefined) joining.remarks = input.remarks ?? ""

  const nextStatus = input.status ?? (joining.status as JoiningConfirmationStatus)
  if (input.status !== undefined) joining.status = input.status

  if (
    input.confirmedBy !== undefined ||
    input.confirmationDate !== undefined ||
    input.status !== undefined
  ) {
    const confirmation = resolveConfirmation(
      nextStatus,
      auth.userId,
      input.confirmedBy ?? (asId(joining.confirmedBy) || undefined),
      input.confirmationDate ?? (dateKeyOf(joining.confirmationDate) || undefined)
    )
    if (confirmation.confirmedBy) {
      await assertConfirmer(auth.organizationId, confirmation.confirmedBy)
    }
    joining.set("confirmedBy", confirmation.confirmedBy)
    joining.confirmationDate = confirmation.confirmationDate
  }

  await assertNoJoining(auth.organizationId, asId(joining.offerId), id)

  try {
    await joining.save()
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw AppError.conflict(MESSAGES.JOINING_EXISTS)
    }
    throw error
  }

  await joining.populate([...JOINING_POPULATE])
  const publicJoining = toPublicJoining(joining.toObject() as Record<string, unknown>)
  const newlyConfirmed =
    isConfirmedJoiningStatus(publicJoining.status) && !isConfirmedJoiningStatus(previousStatus)
  if (newlyConfirmed) {
    await ensureJoiningSideEffects(auth, {
      _id: joining._id,
      organizationId: joining.organizationId,
      clientId: joining.clientId,
      candidateId: joining.candidateId,
      mandateId: joining.mandateId,
      offerId: joining.offerId,
      joiningDate: joining.joiningDate,
    })
    await recordAudit(auth, {
      module: "JOININGS",
      action: "JOINED",
      recordId: publicJoining.id,
      previousData: { status: previousStatus },
      newData: publicJoining,
    })
  }
  return publicJoining
}

export async function deleteJoining(auth: AuthContext, id: string) {
  parseObjectId(id)
  const hasInvoices = await InvoiceModel.exists({
    organizationId: auth.organizationId,
    joiningId: id,
  })
  if (hasInvoices) {
    throw AppError.conflict(MESSAGES.JOINING_HAS_INVOICES)
  }

  const hasGuarantees = await GuaranteeFollowUpModel.exists({
    organizationId: auth.organizationId,
    joiningId: id,
  })
  if (hasGuarantees) {
    throw AppError.conflict(MESSAGES.JOINING_HAS_GUARANTEES)
  }

  const hasReplacements = await ReplacementCaseModel.exists({
    organizationId: auth.organizationId,
    joiningId: id,
  })
  if (hasReplacements) {
    throw AppError.conflict(MESSAGES.JOINING_HAS_REPLACEMENTS)
  }

  const deleted = await JoiningModel.findOneAndDelete({
    _id: id,
    organizationId: auth.organizationId,
  })
  if (!deleted) {
    throw AppError.notFound(MESSAGES.JOINING_NOT_FOUND)
  }
}
