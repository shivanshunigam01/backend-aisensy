import {
  INVOICE_STATUS_LABELS,
  type InvoiceStatus,
} from "../constants/invoices.js"
import { MESSAGES } from "../constants/messages.js"
import { ClientModel } from "../models/client.model.js"
import { InvoicePaymentModel } from "../models/invoice-payment.model.js"
import { InvoiceModel } from "../models/invoice.model.js"
import { JoiningModel } from "../models/joining.model.js"
import type { AuthContext } from "../types/auth.js"
import { recordActivity } from "../utils/activity.js"
import { recordAudit } from "../utils/audit.js"
import { AppError } from "../utils/app-error.js"
import { dateKeyFromDate, utcDateFromKey } from "../utils/dates.js"
import { generateInvoiceNumber } from "../utils/invoice-number.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { applySearch, mongoSort, resolvedSearch } from "../utils/search.js"
import type {
  CreateInvoiceInput,
  InvoiceListQueryInput,
  UpdateInvoiceInput,
} from "../validators/invoice.validators.js"

const INVOICE_POPULATE = [
  { path: "clientId", select: "companyName" },
  { path: "joiningId", select: "joiningDate status candidateId clientId" },
] as const

export function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100
}

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

function toClientRef(value: unknown) {
  if (!value) return null
  if (typeof value === "object" && value !== null && ("companyName" in value || "_id" in value)) {
    const client = value as { _id: unknown; companyName?: string }
    return { id: String(client._id), companyName: client.companyName ?? "" }
  }
  return { id: String(value), companyName: "" }
}

function toJoiningRef(value: unknown) {
  if (!value) return null
  if (typeof value === "object" && value !== null && ("joiningDate" in value || "_id" in value)) {
    const joining = value as {
      _id: unknown
      joiningDate?: unknown
      status?: string
    }
    return {
      id: String(joining._id),
      joiningDate: dateKeyOf(joining.joiningDate),
      status: joining.status ?? "",
    }
  }
  return { id: String(value), joiningDate: "", status: "" }
}

function statusFromBalances(
  current: InvoiceStatus,
  paidAmount: number,
  outstandingAmount: number,
  dueDate?: Date | null
): InvoiceStatus {
  if (current === "CANCELLED") return "CANCELLED"
  if (outstandingAmount <= 0 && paidAmount > 0) return "PAID"
  if (
    outstandingAmount > 0 &&
    dueDate &&
    dateKeyFromDate(new Date()) > dateKeyFromDate(dueDate) &&
    current !== "PAID"
  ) {
    return "OVERDUE"
  }
  if (paidAmount <= 0) {
    if (current === "DRAFT") return "DRAFT"
    if (current === "ISSUED") return "ISSUED"
    if (current === "OVERDUE") return "OVERDUE"
    return "SENT"
  }
  return "PARTIALLY_PAID"
}

export function toPublicInvoice(doc: Record<string, unknown>) {
  const client = toClientRef(doc.clientId)
  const joining = doc.joiningId ? toJoiningRef(doc.joiningId) : null
  const status = (String(doc.status ?? "SENT") as InvoiceStatus) || "SENT"
  const amount = roundMoney(Number(doc.amount ?? 0))
  const paidAmount = roundMoney(Number(doc.paidAmount ?? 0))
  const outstandingAmount = roundMoney(Number(doc.outstandingAmount ?? Math.max(0, amount - paidAmount)))
  const professionalFeeRaw = doc.professionalFee
  const professionalFee =
    professionalFeeRaw === null || professionalFeeRaw === undefined
      ? amount
      : roundMoney(Number(professionalFeeRaw))

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    clientId: client?.id ?? asId(doc.clientId),
    client,
    joiningId: joining?.id ?? (asId(doc.joiningId) || ""),
    joining,
    candidateId: asId(doc.candidateId) || "",
    mandateId: asId(doc.mandateId) || "",
    invoiceNumber: String(doc.invoiceNumber ?? ""),
    invoiceDate: dateKeyOf(doc.invoiceDate),
    dueDate: dateKeyOf(doc.dueDate),
    professionalFee,
    gstRatePercent:
      doc.gstRatePercent === null || doc.gstRatePercent === undefined
        ? null
        : Number(doc.gstRatePercent),
    gstSplitMode: String(doc.gstSplitMode ?? ""),
    cgst: roundMoney(Number(doc.cgst ?? 0)),
    sgst: roundMoney(Number(doc.sgst ?? 0)),
    igst: roundMoney(Number(doc.igst ?? 0)),
    gstAmount: roundMoney(Number(doc.gstAmount ?? 0)),
    amount,
    paidAmount,
    outstandingAmount,
    feeType: String(doc.feeType ?? ""),
    feeBasisCtc:
      doc.feeBasisCtc === null || doc.feeBasisCtc === undefined ? null : Number(doc.feeBasisCtc),
    autoGenerated: Boolean(doc.autoGenerated),
    status,
    statusLabel: INVOICE_STATUS_LABELS[status] ?? status,
    remarks: String(doc.remarks ?? ""),
    createdAt: isoOf(doc.createdAt),
    updatedAt: isoOf(doc.updatedAt),
  }
}

async function requireInvoice(organizationId: string, id: string) {
  parseObjectId(id)
  const invoice = await InvoiceModel.findOne({ _id: id, organizationId }).populate([
    ...INVOICE_POPULATE,
  ])
  if (!invoice) {
    throw AppError.notFound(MESSAGES.INVOICE_NOT_FOUND)
  }
  return invoice
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
    "_id clientId joiningDate status"
  )
  if (!joining) {
    throw AppError.badRequest(MESSAGES.JOINING_NOT_FOUND)
  }
  return joining
}

export async function recalculateInvoiceBalances(organizationId: string, invoiceId: string) {
  parseObjectId(invoiceId)
  const invoice = await InvoiceModel.findOne({ _id: invoiceId, organizationId })
  if (!invoice) {
    throw AppError.notFound(MESSAGES.INVOICE_NOT_FOUND)
  }

  const paid = await InvoicePaymentModel.aggregate<{ total: number }>([
    {
      $match: {
        organizationId: invoice.organizationId,
        invoiceId: invoice._id,
        status: "COMPLETED",
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ])

  const paidAmount = roundMoney(paid[0]?.total ?? 0)
  const amount = roundMoney(Number(invoice.amount ?? 0))
  const outstandingAmount = roundMoney(Math.max(0, amount - paidAmount))
  const nextStatus = statusFromBalances(
    invoice.status as InvoiceStatus,
    paidAmount,
    outstandingAmount,
    invoice.dueDate ?? null
  )

  invoice.paidAmount = paidAmount
  invoice.outstandingAmount = outstandingAmount
  invoice.status = nextStatus
  await invoice.save()
  await invoice.populate([...INVOICE_POPULATE])
  return invoice
}

export async function listInvoices(auth: AuthContext, query: InvoiceListQueryInput) {
  const filter: Record<string, unknown> = { organizationId: auth.organizationId }

  if (query.clientId) {
    parseObjectId(query.clientId, "Invalid client")
    filter.clientId = query.clientId
  }
  if (query.joiningId) {
    parseObjectId(query.joiningId, "Invalid joining")
    filter.joiningId = query.joiningId
  }
  if (query.status) filter.status = query.status

  applySearch(filter, ["invoiceNumber", "remarks"], resolvedSearch(query))

  const [items, total] = await Promise.all([
    InvoiceModel.find(filter)
      .populate([...INVOICE_POPULATE])
      .sort(mongoSort(query, { invoiceDate: -1, createdAt: -1 }))
      .skip(paginationSkip(query))
      .limit(query.limit)
      .lean(),
    InvoiceModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicInvoice(item as Record<string, unknown>)),
    ...paginationMeta(total, query),
  }
}

export async function getInvoice(auth: AuthContext, id: string) {
  const invoice = await requireInvoice(auth.organizationId, id)
  return toPublicInvoice(invoice.toObject() as Record<string, unknown>)
}

export async function createInvoice(auth: AuthContext, input: CreateInvoiceInput) {
  if (!input.clientId && !input.joiningId) {
    throw AppError.badRequest(MESSAGES.INVOICE_CLIENT_REQUIRED)
  }

  let clientId = input.clientId
  let joiningId = input.joiningId ?? null

  if (joiningId) {
    const joining = await assertJoining(auth.organizationId, joiningId)
    const joiningClientId = String(joining.clientId)
    if (clientId && clientId !== joiningClientId) {
      throw AppError.badRequest(MESSAGES.JOINING_CLIENT_MISMATCH)
    }
    clientId = joiningClientId
  }

  const client = await assertClient(auth.organizationId, clientId!)
  const professionalFee = roundMoney(
    input.professionalFee ?? input.amount ?? 0
  )
  const gstRatePercent =
    input.gstRatePercent === undefined || input.gstRatePercent === null
      ? null
      : Number(input.gstRatePercent)
  const gstSplitMode = input.gstSplitMode ?? ""
  const gstAmount =
    gstRatePercent === null ? 0 : roundMoney((professionalFee * gstRatePercent) / 100)
  const half = roundMoney(gstAmount / 2)
  const cgst = gstSplitMode === "CGST_SGST" ? half : 0
  const sgst = gstSplitMode === "CGST_SGST" ? roundMoney(gstAmount - half) : 0
  const igst = gstSplitMode === "IGST" ? gstAmount : 0
  const amount = roundMoney(input.amount ?? professionalFee + gstAmount)
  const status = input.status ?? "SENT"
  const invoiceDate = dateFromKey(input.invoiceDate) ?? new Date()
  const dueDate = dateFromKey(input.dueDate)

  let created
  try {
    created = await InvoiceModel.create({
      organizationId: auth.organizationId,
      clientId: client._id,
      joiningId: joiningId || null,
      invoiceNumber: await generateInvoiceNumber(auth.organizationId),
      invoiceDate,
      dueDate,
      professionalFee,
      gstRatePercent,
      gstSplitMode,
      cgst,
      sgst,
      igst,
      gstAmount,
      amount,
      paidAmount: 0,
      outstandingAmount: amount,
      status,
      remarks: input.remarks ?? "",
      autoGenerated: false,
    })
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw AppError.conflict(MESSAGES.INVOICE_NUMBER_IN_USE)
    }
    throw error
  }

  await created.populate([...INVOICE_POPULATE])
  const publicInvoice = toPublicInvoice(created.toObject() as Record<string, unknown>)
  await recordActivity(auth.organizationId, {
    title: `Invoice ${created.invoiceNumber} recorded`,
    detail: `${client.companyName} · ${amount}`,
    tone: "success",
  })
  await recordAudit(auth, {
    module: "INVOICES",
    action: "CREATED",
    recordId: publicInvoice.id,
    newData: publicInvoice,
  })

  return publicInvoice
}

export async function updateInvoice(auth: AuthContext, id: string, input: UpdateInvoiceInput) {
  const invoice = await requireInvoice(auth.organizationId, id)

  if (input.joiningId !== undefined) {
    if (!input.joiningId) {
      invoice.set("joiningId", null)
    } else {
      const joining = await assertJoining(auth.organizationId, input.joiningId)
      invoice.set("joiningId", joining._id)
      if (input.clientId === undefined) invoice.set("clientId", joining.clientId)
    }
  }
  if (input.clientId !== undefined) {
    const client = await assertClient(auth.organizationId, input.clientId)
    invoice.set("clientId", client._id)
  }

  if (invoice.joiningId) {
    const joining = await assertJoining(auth.organizationId, asId(invoice.joiningId))
    if (String(joining.clientId) !== asId(invoice.clientId)) {
      throw AppError.badRequest(MESSAGES.JOINING_CLIENT_MISMATCH)
    }
  }

  if (input.invoiceDate !== undefined) {
    invoice.invoiceDate = dateFromKey(input.invoiceDate) ?? invoice.invoiceDate
  }
  if (input.dueDate !== undefined) {
    invoice.dueDate = dateFromKey(input.dueDate)
  }
  if (input.professionalFee !== undefined) {
    invoice.professionalFee = roundMoney(input.professionalFee)
  }
  if (input.gstRatePercent !== undefined) {
    invoice.gstRatePercent = input.gstRatePercent
  }
  if (input.gstSplitMode !== undefined) {
    invoice.gstSplitMode = input.gstSplitMode
  }
  if (
    input.professionalFee !== undefined ||
    input.gstRatePercent !== undefined ||
    input.gstSplitMode !== undefined
  ) {
    const fee = roundMoney(Number(invoice.professionalFee ?? invoice.amount ?? 0))
    const rate = Number(invoice.gstRatePercent ?? 0)
    const gstAmount = roundMoney((fee * rate) / 100)
    const mode = String(invoice.gstSplitMode ?? "")
    const half = roundMoney(gstAmount / 2)
    invoice.gstAmount = gstAmount
    invoice.cgst = mode === "CGST_SGST" ? half : 0
    invoice.sgst = mode === "CGST_SGST" ? roundMoney(gstAmount - half) : 0
    invoice.igst = mode === "IGST" ? gstAmount : 0
    if (input.amount === undefined) {
      invoice.amount = roundMoney(fee + gstAmount)
    }
  }
  if (input.amount !== undefined) invoice.amount = roundMoney(input.amount)
  if (input.remarks !== undefined) invoice.remarks = input.remarks ?? ""
  if (input.status !== undefined) invoice.status = input.status

  try {
    await invoice.save()
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw AppError.conflict(MESSAGES.INVOICE_NUMBER_IN_USE)
    }
    throw error
  }

  const refreshed = await recalculateInvoiceBalances(auth.organizationId, id)
  return toPublicInvoice(refreshed.toObject() as Record<string, unknown>)
}

export async function deleteInvoice(auth: AuthContext, id: string) {
  parseObjectId(id)
  const hasPayments = await InvoicePaymentModel.exists({
    organizationId: auth.organizationId,
    invoiceId: id,
  })
  if (hasPayments) {
    throw AppError.conflict(MESSAGES.INVOICE_HAS_PAYMENTS)
  }

  const deleted = await InvoiceModel.findOneAndDelete({
    _id: id,
    organizationId: auth.organizationId,
  })
  if (!deleted) {
    throw AppError.notFound(MESSAGES.INVOICE_NOT_FOUND)
  }
}
