import {
  AGREEMENT_FEE_TYPE_LABELS,
  AGREEMENT_STATUS_LABELS,
  DEFAULT_DUPLICATE_NOTIFICATION_DAYS,
  DEFAULT_GST_RATE_PERCENT,
  DEFAULT_OWNERSHIP_PERIOD_MONTHS,
  DEFAULT_PAYMENT_TERMS_DAYS,
  DEFAULT_REPLACEMENT_PERIOD_DAYS,
  type AgreementFeeType,
  type AgreementStatus,
} from "../constants/agreements.js"
import { GST_SPLIT_MODES, type GstSplitMode } from "../constants/invoices.js"
import { MESSAGES } from "../constants/messages.js"
import { ClientAgreementModel } from "../models/client-agreement.model.js"
import { ClientModel } from "../models/client.model.js"
import { RecruitmentMandateModel } from "../models/recruitment-mandate.model.js"
import type { AuthContext } from "../types/auth.js"
import { recordActivity } from "../utils/activity.js"
import { recordAudit } from "../utils/audit.js"
import { generateAgreementNumber } from "../utils/agreement-number.js"
import { AppError } from "../utils/app-error.js"
import { utcDateFromKey } from "../utils/dates.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { applySearch, mongoSort, resolvedSearch } from "../utils/search.js"
import type {
  AgreementListQueryInput,
  CreateAgreementInput,
  UpdateAgreementInput,
} from "../validators/agreement.validators.js"

const AGREEMENT_POPULATE = [
  { path: "clientId", select: "companyName status industry" },
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

function toSignedDocument(value: unknown) {
  if (!value || typeof value !== "object") {
    return null
  }

  const doc = value as { fileUrl?: string; fileName?: string }
  const fileUrl = String(doc.fileUrl ?? "").trim()
  if (!fileUrl) {
    return null
  }

  return {
    fileUrl,
    fileName: String(doc.fileName ?? ""),
  }
}

function commercialOf(value: unknown) {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  const feeType = (String(source.feeType ?? "PERCENTAGE") as AgreementFeeType) || "PERCENTAGE"
  const gstSplitMode =
    (String(source.gstSplitMode ?? "CGST_SGST") as GstSplitMode) || "CGST_SGST"

  return {
    recruitmentFee: Number(source.recruitmentFee ?? 0),
    feeType,
    feeTypeLabel: AGREEMENT_FEE_TYPE_LABELS[feeType] ?? feeType,
    paymentTermsDays: Number(source.paymentTermsDays ?? DEFAULT_PAYMENT_TERMS_DAYS),
    gstRatePercent: Number(source.gstRatePercent ?? DEFAULT_GST_RATE_PERCENT),
    gstSplitMode,
    gstSplitModeLabel: (GST_SPLIT_MODES as readonly string[]).includes(gstSplitMode)
      ? gstSplitMode
      : "CGST_SGST",
  }
}

function resolvedStatus(stored: AgreementStatus, expiryDate: string) {
  if (stored === "ACTIVE" && expiryDate && expiryDate < new Date().toISOString().slice(0, 10)) {
    return "EXPIRED" as const
  }
  return stored
}

export function toPublicAgreement(doc: Record<string, unknown>) {
  const storedStatus = (String(doc.status ?? "DRAFT") as AgreementStatus) || "DRAFT"
  const expiryDate = dateKeyOf(doc.expiryDate)
  const status = resolvedStatus(storedStatus, expiryDate)
  const client = toClientRef(doc.clientId)
  const commercialTerms = commercialOf(doc.commercialTerms)

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    clientId: client?.id ?? asId(doc.clientId),
    client,
    agreementNumber: String(doc.agreementNumber ?? ""),
    effectiveDate: dateKeyOf(doc.effectiveDate),
    expiryDate,
    signedDate: dateKeyOf(doc.signedDate),
    commercialTerms,
    ownershipPeriodMonths: Number(doc.ownershipPeriodMonths ?? DEFAULT_OWNERSHIP_PERIOD_MONTHS),
    duplicateNotificationDays: Number(
      doc.duplicateNotificationDays ?? DEFAULT_DUPLICATE_NOTIFICATION_DAYS
    ),
    replacementPeriodDays: Number(doc.replacementPeriodDays ?? DEFAULT_REPLACEMENT_PERIOD_DAYS),
    status,
    storedStatus,
    statusLabel: AGREEMENT_STATUS_LABELS[status] ?? status,
    signedDocument: toSignedDocument(doc.signedDocument),
    createdBy: toUserRef(doc.createdBy),
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

async function requireAgreement(organizationId: string, id: string) {
  parseObjectId(id)
  const agreement = await ClientAgreementModel.findOne({ _id: id, organizationId }).populate([
    ...AGREEMENT_POPULATE,
  ])

  if (!agreement) {
    throw AppError.notFound(MESSAGES.AGREEMENT_NOT_FOUND)
  }

  return agreement
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

function dateFromKey(value?: string | null) {
  if (!value) return null
  return utcDateFromKey(value)
}

function signedDocumentOf(input: CreateAgreementInput["signedDocument"]) {
  if (input === null) return null
  if (!input?.fileUrl) return null
  return {
    fileUrl: input.fileUrl,
    fileName: input.fileName ?? "",
  }
}

function commercialTermsOf(input?: CreateAgreementInput["commercialTerms"]) {
  return {
    recruitmentFee: input?.recruitmentFee ?? 0,
    feeType: input?.feeType ?? "PERCENTAGE",
    paymentTermsDays: input?.paymentTermsDays ?? DEFAULT_PAYMENT_TERMS_DAYS,
    gstRatePercent: input?.gstRatePercent ?? DEFAULT_GST_RATE_PERCENT,
    gstSplitMode: input?.gstSplitMode ?? "CGST_SGST",
  }
}

function statusWithSignedDate(status: AgreementStatus, signedDate: Date | null, effectiveDate: Date) {
  if (status === "ACTIVE" && !signedDate) {
    return effectiveDate
  }
  return signedDate
}

async function createAgreementDocument(auth: AuthContext, input: CreateAgreementInput) {
  const client = await assertClient(auth.organizationId, input.clientId)
  const agreementNumber = await generateAgreementNumber(auth.organizationId)
  const effectiveDate = dateFromKey(input.effectiveDate)!
  const status = input.status ?? "DRAFT"
  const signedDate = statusWithSignedDate(status, dateFromKey(input.signedDate), effectiveDate)

  return ClientAgreementModel.create({
    organizationId: auth.organizationId,
    clientId: client._id,
    agreementNumber,
    createdBy: auth.userId,
    effectiveDate,
    expiryDate: dateFromKey(input.expiryDate),
    signedDate,
    commercialTerms: commercialTermsOf(input.commercialTerms),
    ownershipPeriodMonths: input.ownershipPeriodMonths ?? DEFAULT_OWNERSHIP_PERIOD_MONTHS,
    duplicateNotificationDays:
      input.duplicateNotificationDays ?? DEFAULT_DUPLICATE_NOTIFICATION_DAYS,
    replacementPeriodDays: input.replacementPeriodDays ?? DEFAULT_REPLACEMENT_PERIOD_DAYS,
    status,
    signedDocument: signedDocumentOf(input.signedDocument),
  })
}

export async function listAgreements(auth: AuthContext, query: AgreementListQueryInput) {
  const filter: Record<string, unknown> = { organizationId: auth.organizationId }

  if (query.status) filter.status = query.status
  if (query.clientId) {
    parseObjectId(query.clientId, "Invalid client")
    filter.clientId = query.clientId
  }
  applySearch(filter, ["agreementNumber"], resolvedSearch(query))

  const [items, total] = await Promise.all([
    ClientAgreementModel.find(filter)
      .populate([...AGREEMENT_POPULATE])
      .sort(mongoSort(query, { createdAt: -1 }))
      .skip(paginationSkip(query))
      .limit(query.limit)
      .lean(),
    ClientAgreementModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicAgreement(item as Record<string, unknown>)),
    ...paginationMeta(total, query),
  }
}

export async function getAgreement(auth: AuthContext, id: string) {
  const agreement = await requireAgreement(auth.organizationId, id)
  return toPublicAgreement(agreement.toObject() as Record<string, unknown>)
}

export async function createAgreement(auth: AuthContext, input: CreateAgreementInput) {
  let created
  try {
    created = await createAgreementDocument(auth, input)
  } catch (error) {
    if (!isDuplicateKey(error, "agreementNumber")) {
      throw error
    }
    created = await createAgreementDocument(auth, input)
  }

  await created.populate([...AGREEMENT_POPULATE])
  const publicAgreement = toPublicAgreement(created.toObject() as Record<string, unknown>)
  await recordActivity(auth.organizationId, {
    title: `Agreement ${created.agreementNumber} created`,
    detail: "Client commercial terms recorded",
    tone: "success",
  })
  await recordAudit(auth, {
    module: "AGREEMENTS",
    action: "CREATED",
    recordId: publicAgreement.id,
    newData: publicAgreement,
  })

  return publicAgreement
}

export async function updateAgreement(auth: AuthContext, id: string, input: UpdateAgreementInput) {
  const agreement = await requireAgreement(auth.organizationId, id)

  if (input.clientId !== undefined) {
    const client = await assertClient(auth.organizationId, input.clientId)
    agreement.set("clientId", client._id)
  }

  if (input.effectiveDate !== undefined) {
    agreement.effectiveDate = dateFromKey(input.effectiveDate) ?? agreement.effectiveDate
  }
  if (input.expiryDate !== undefined) {
    agreement.expiryDate = dateFromKey(input.expiryDate)
  }
  if (input.signedDate !== undefined) {
    agreement.signedDate = dateFromKey(input.signedDate)
  }
  if (input.commercialTerms !== undefined) {
    agreement.set("commercialTerms", {
      recruitmentFee: input.commercialTerms.recruitmentFee ?? agreement.commercialTerms.recruitmentFee,
      feeType: input.commercialTerms.feeType ?? agreement.commercialTerms.feeType,
      paymentTermsDays:
        input.commercialTerms.paymentTermsDays ?? agreement.commercialTerms.paymentTermsDays,
    })
  }
  if (input.ownershipPeriodMonths !== undefined) {
    agreement.ownershipPeriodMonths = input.ownershipPeriodMonths
  }
  if (input.duplicateNotificationDays !== undefined) {
    agreement.duplicateNotificationDays = input.duplicateNotificationDays
  }
  if (input.replacementPeriodDays !== undefined) {
    agreement.replacementPeriodDays = input.replacementPeriodDays
  }
  if (input.status !== undefined) {
    agreement.status = input.status
    if (input.status === "ACTIVE" && !agreement.signedDate) {
      agreement.signedDate = agreement.effectiveDate
    }
  }
  if (input.signedDocument !== undefined) {
    agreement.set("signedDocument", signedDocumentOf(input.signedDocument))
  }

  await agreement.save()
  await agreement.populate([...AGREEMENT_POPULATE])

  return toPublicAgreement(agreement.toObject() as Record<string, unknown>)
}

export async function deleteAgreement(auth: AuthContext, id: string) {
  parseObjectId(id)
  const existing = await ClientAgreementModel.findOne({
    _id: id,
    organizationId: auth.organizationId,
  }).select("status")

  if (!existing) {
    throw AppError.notFound(MESSAGES.AGREEMENT_NOT_FOUND)
  }

  if (existing.status === "ACTIVE") {
    throw AppError.conflict(MESSAGES.AGREEMENT_ACTIVE)
  }

  const linked = await RecruitmentMandateModel.exists({
    organizationId: auth.organizationId,
    agreementId: id,
  })
  if (linked) {
    throw AppError.conflict(MESSAGES.AGREEMENT_HAS_MANDATES)
  }

  await ClientAgreementModel.findOneAndDelete({
    _id: id,
    organizationId: auth.organizationId,
  })
}
