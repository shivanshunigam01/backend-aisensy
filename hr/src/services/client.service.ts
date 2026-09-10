import {
  CLIENT_KYC_LABELS,
  CLIENT_ONBOARDING_LABELS,
  CLIENT_STATUS_LABELS,
  type ClientKycStatus,
  type ClientOnboardingStatus,
  type ClientStatus,
} from "../constants/clients.js"
import { MESSAGES } from "../constants/messages.js"
import { CandidateSubmissionModel } from "../models/candidate-submission.model.js"
import { ClientAgreementModel } from "../models/client-agreement.model.js"
import { ClientModel } from "../models/client.model.js"
import { GuaranteeFollowUpModel } from "../models/guarantee-follow-up.model.js"
import { InvoiceModel } from "../models/invoice.model.js"
import { ReplacementCaseModel } from "../models/replacement-case.model.js"
import { JoiningModel } from "../models/joining.model.js"
import { RecruitmentMandateModel } from "../models/recruitment-mandate.model.js"
import type { AuthContext } from "../types/auth.js"
import { recordActivity } from "../utils/activity.js"
import { recordAudit } from "../utils/audit.js"
import { AppError } from "../utils/app-error.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { applySearch, mongoSort, resolvedSearch } from "../utils/search.js"
import type {
  ClientListQueryInput,
  CreateClientInput,
  UpdateClientInput,
} from "../validators/client.validators.js"

const CREATED_BY_POPULATE = { path: "createdBy", select: "name email" }

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

function toContactPerson(value: unknown) {
  if (!value || typeof value !== "object") {
    return null
  }

  const person = value as {
    _id?: unknown
    id?: unknown
    name?: string
    designation?: string
    email?: string
    phone?: string
  }

  return {
    id: String(person._id ?? person.id ?? ""),
    name: String(person.name ?? ""),
    designation: String(person.designation ?? ""),
    email: String(person.email ?? ""),
    phone: String(person.phone ?? ""),
  }
}

function toCreatedBy(value: unknown) {
  if (!value) return null

  if (typeof value === "object" && value !== null && "name" in value) {
    const user = value as { _id: unknown; name: string; email?: string }
    return {
      id: String(user._id),
      name: user.name,
      email: user.email ?? "",
    }
  }

  return { id: String(value), name: "", email: "" }
}

export function toPublicClient(doc: Record<string, unknown>) {
  const status = (String(doc.status ?? "LEAD") as ClientStatus) || "LEAD"
  const onboardingStatus = (String(doc.onboardingStatus ?? "PENDING") as ClientOnboardingStatus) || "PENDING"
  const KYCStatus = (String(doc.KYCStatus ?? "PENDING") as ClientKycStatus) || "PENDING"
  const registeredAddress = String(doc.registeredAddress || doc.address || "")

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    companyName: String(doc.companyName ?? ""),
    legalEntityName: String(doc.legalEntityName ?? ""),
    industry: String(doc.industry ?? ""),
    website: String(doc.website ?? ""),
    GSTNumber: String(doc.GSTNumber ?? ""),
    PANNumber: String(doc.PANNumber ?? ""),
    registeredAddress,
    address: registeredAddress,
    city: String(doc.city ?? ""),
    state: String(doc.state ?? ""),
    country: String(doc.country ?? ""),
    contactPersons: Array.isArray(doc.contactPersons)
      ? doc.contactPersons
          .map(toContactPerson)
          .filter((person): person is NonNullable<typeof person> => person !== null)
      : [],
    status,
    statusLabel: CLIENT_STATUS_LABELS[status] ?? status,
    onboardingStatus,
    onboardingStatusLabel: CLIENT_ONBOARDING_LABELS[onboardingStatus] ?? onboardingStatus,
    KYCStatus,
    KYCStatusLabel: CLIENT_KYC_LABELS[KYCStatus] ?? KYCStatus,
    notes: String(doc.notes ?? ""),
    createdBy: toCreatedBy(doc.createdBy),
    createdAt: isoOf(doc.createdAt),
    updatedAt: isoOf(doc.updatedAt),
  }
}

async function requireClient(organizationId: string, id: string) {
  parseObjectId(id)
  const client = await ClientModel.findOne({ _id: id, organizationId }).populate(CREATED_BY_POPULATE)

  if (!client) {
    throw AppError.notFound(MESSAGES.CLIENT_NOT_FOUND)
  }

  return client
}

function contactPersonsOf(input: CreateClientInput["contactPersons"]) {
  if (!input) return []

  return input.map((person) => ({
    name: person.name,
    designation: person.designation ?? "",
    email: person.email ?? "",
    phone: person.phone ?? "",
  }))
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

function throwDuplicate(error: unknown): never {
  if (isDuplicateKey(error, "GSTNumber")) {
    throw AppError.conflict(MESSAGES.CLIENT_GST_IN_USE)
  }
  if (isDuplicateKey(error, "PANNumber")) {
    throw AppError.conflict(MESSAGES.CLIENT_PAN_IN_USE)
  }
  throw error
}

function addressOf(input: CreateClientInput | UpdateClientInput) {
  return input.registeredAddress ?? input.address ?? ""
}

export async function listClients(auth: AuthContext, query: ClientListQueryInput) {
  const filter: Record<string, unknown> = { organizationId: auth.organizationId }

  if (query.status) {
    filter.status = query.status
  }
  if (query.onboardingStatus) {
    filter.onboardingStatus = query.onboardingStatus
  }
  if (query.KYCStatus) {
    filter.KYCStatus = query.KYCStatus
  }

  applySearch(filter, ["companyName", "legalEntityName", "GSTNumber", "PANNumber", "city"], resolvedSearch(query))

  const [items, total] = await Promise.all([
    ClientModel.find(filter)
      .populate(CREATED_BY_POPULATE)
      .sort(mongoSort(query, { createdAt: -1 }))
      .skip(paginationSkip(query))
      .limit(query.limit)
      .lean(),
    ClientModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicClient(item as Record<string, unknown>)),
    ...paginationMeta(total, query),
  }
}

export async function getClient(auth: AuthContext, id: string) {
  const client = await requireClient(auth.organizationId, id)
  return toPublicClient(client.toObject() as Record<string, unknown>)
}

export async function createClient(auth: AuthContext, input: CreateClientInput) {
  const address = addressOf(input)

  try {
    const created = await ClientModel.create({
      organizationId: auth.organizationId,
      companyName: input.companyName,
      legalEntityName: input.legalEntityName ?? "",
      industry: input.industry ?? "",
      website: input.website ?? "",
      GSTNumber: input.GSTNumber ?? "",
      PANNumber: input.PANNumber ?? "",
      registeredAddress: address,
      address,
      city: input.city ?? "",
      state: input.state ?? "",
      country: input.country ?? "",
      contactPersons: contactPersonsOf(input.contactPersons),
      status: input.status ?? "LEAD",
      onboardingStatus: input.onboardingStatus ?? "PENDING",
      KYCStatus: input.KYCStatus ?? "PENDING",
      notes: input.notes ?? "",
      createdBy: auth.userId,
    })

    await created.populate(CREATED_BY_POPULATE)
    const publicClient = toPublicClient(created.toObject() as Record<string, unknown>)
    await recordActivity(auth.organizationId, {
      title: `${created.companyName} added as a client`,
      detail: created.industry || created.status,
      tone: "success",
    })
    await recordAudit(auth, {
      module: "CLIENTS",
      action: "CREATED",
      recordId: publicClient.id,
      newData: publicClient,
    })

    return publicClient
  } catch (error) {
    throwDuplicate(error)
  }
}

export async function updateClient(auth: AuthContext, id: string, input: UpdateClientInput) {
  const client = await requireClient(auth.organizationId, id)
  const previousData = toPublicClient(client.toObject() as Record<string, unknown>)

  if (input.companyName !== undefined) client.companyName = input.companyName
  if (input.legalEntityName !== undefined) client.legalEntityName = input.legalEntityName ?? ""
  if (input.industry !== undefined) client.industry = input.industry ?? ""
  if (input.website !== undefined) client.website = input.website ?? ""
  if (input.GSTNumber !== undefined) client.GSTNumber = input.GSTNumber ?? ""
  if (input.PANNumber !== undefined) client.PANNumber = input.PANNumber ?? ""
  if (input.contactPersons !== undefined) {
    client.set("contactPersons", contactPersonsOf(input.contactPersons))
  }
  if (input.registeredAddress !== undefined || input.address !== undefined) {
    const address = addressOf(input)
    client.registeredAddress = address
    client.address = address
  }
  if (input.city !== undefined) client.city = input.city ?? ""
  if (input.state !== undefined) client.state = input.state ?? ""
  if (input.country !== undefined) client.country = input.country ?? ""
  if (input.status !== undefined) client.status = input.status
  if (input.onboardingStatus !== undefined) client.onboardingStatus = input.onboardingStatus
  if (input.KYCStatus !== undefined) client.KYCStatus = input.KYCStatus
  if (input.notes !== undefined) client.notes = input.notes ?? ""

  try {
    await client.save()
  } catch (error) {
    throwDuplicate(error)
  }
  await client.populate(CREATED_BY_POPULATE)
  const publicClient = toPublicClient(client.toObject() as Record<string, unknown>)
  await recordAudit(auth, {
    module: "CLIENTS",
    action: "UPDATED",
    recordId: publicClient.id,
    previousData,
    newData: publicClient,
  })

  return publicClient
}

export async function deleteClient(auth: AuthContext, id: string) {
  parseObjectId(id)
  const linked = await RecruitmentMandateModel.exists({
    organizationId: auth.organizationId,
    clientId: id,
  })
  if (linked) {
    throw AppError.conflict(MESSAGES.CLIENT_HAS_MANDATES)
  }

  const hasAgreements = await ClientAgreementModel.exists({
    organizationId: auth.organizationId,
    clientId: id,
  })
  if (hasAgreements) {
    throw AppError.conflict(MESSAGES.CLIENT_HAS_AGREEMENTS)
  }

  const hasSubmissions = await CandidateSubmissionModel.exists({
    organizationId: auth.organizationId,
    clientId: id,
  })
  if (hasSubmissions) {
    throw AppError.conflict(MESSAGES.CLIENT_HAS_SUBMISSIONS)
  }

  const hasJoinings = await JoiningModel.exists({
    organizationId: auth.organizationId,
    clientId: id,
  })
  if (hasJoinings) {
    throw AppError.conflict(MESSAGES.CLIENT_HAS_JOININGS)
  }

  const hasInvoices = await InvoiceModel.exists({
    organizationId: auth.organizationId,
    clientId: id,
  })
  if (hasInvoices) {
    throw AppError.conflict(MESSAGES.CLIENT_HAS_INVOICES)
  }

  const hasGuarantees = await GuaranteeFollowUpModel.exists({
    organizationId: auth.organizationId,
    clientId: id,
  })
  if (hasGuarantees) {
    throw AppError.conflict(MESSAGES.CLIENT_HAS_GUARANTEES)
  }

  const hasReplacements = await ReplacementCaseModel.exists({
    organizationId: auth.organizationId,
    clientId: id,
  })
  if (hasReplacements) {
    throw AppError.conflict(MESSAGES.CLIENT_HAS_REPLACEMENTS)
  }

  const deleted = await ClientModel.findOneAndDelete({
    _id: id,
    organizationId: auth.organizationId,
  })

  if (!deleted) {
    throw AppError.notFound(MESSAGES.CLIENT_NOT_FOUND)
  }
}
