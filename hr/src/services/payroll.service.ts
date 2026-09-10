import mongoose from "mongoose"

import { MESSAGES } from "../constants/messages.js"
import { PAYROLL_ELIGIBLE_STATUSES, PAYROLL_CURRENCY } from "../constants/payroll.js"
import { EmployeeModel } from "../models/employee.model.js"
import { OrganizationModel } from "../models/organization.model.js"
import { PayrollModel } from "../models/payroll.model.js"
import { SalaryStructureModel } from "../models/salary-structure.model.js"
import type { AuthContext } from "../types/auth.js"
import { recordActivity } from "../utils/activity.js"
import { AppError } from "../utils/app-error.js"
import {
  dateKeyFromDate,
  dateKeyInTimeZone,
  formatShortDate,
  initialsFromName,
  utcDateFromKey,
} from "../utils/dates.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import {
  computePayroll,
  lastDateKeyOfMonth,
  periodLabel,
  type SalaryAmounts,
} from "../utils/payroll.js"
import { escapeRegex, mongoSort, resolvedSearch } from "../utils/search.js"
import type {
  CreateSalaryStructureInput,
  GeneratePayrollInput,
  PayrollListQueryInput,
  PayrollPreviewQueryInput,
  StructureListQueryInput,
  UpdateSalaryStructureInput,
} from "../validators/payroll.validators.js"

const DEFAULT_TIMEZONE = "Asia/Kolkata"

type EmployeeCard = {
  _id: mongoose.Types.ObjectId
  firstName: string
  lastName: string
  profileImage?: string
  employeeCode?: string
  departmentId?: { name?: string } | mongoose.Types.ObjectId | null
  designationId?: { title?: string } | mongoose.Types.ObjectId | null
}

const EMPLOYEE_POPULATE = {
  path: "employeeId",
  select: "firstName lastName profileImage employeeCode departmentId designationId",
  populate: [
    { path: "departmentId", select: "name" },
    { path: "designationId", select: "title" },
  ],
}

function asId(value: unknown) {
  if (!value) return ""
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id: unknown })._id)
  }
  return String(value)
}

function employeeName(employee: { firstName?: string; lastName?: string }) {
  return `${employee.firstName ?? ""} ${employee.lastName ?? ""}`.trim() || "Unknown"
}

function toEmployeeCard(employee: EmployeeCard) {
  const name = employeeName(employee)
  const department =
    employee.departmentId && typeof employee.departmentId === "object" && "name" in employee.departmentId
      ? employee.departmentId.name ?? null
      : null
  const designation =
    employee.designationId && typeof employee.designationId === "object" && "title" in employee.designationId
      ? employee.designationId.title ?? null
      : null

  return {
    id: String(employee._id),
    name,
    initials: initialsFromName(name),
    profileImage: employee.profileImage ?? "",
    employeeCode: employee.employeeCode ?? "",
    department,
    designation,
  }
}

function todayKey() {
  return dateKeyInTimeZone(new Date(), DEFAULT_TIMEZONE)
}

function currentPeriod() {
  const [year, month] = todayKey().split("-").map(Number)
  return { year: year ?? 1970, month: month ?? 1 }
}

function dateKeyOf(value: unknown) {
  if (value instanceof Date) return dateKeyFromDate(value)
  if (typeof value === "string" && value) {
    return dateKeyFromDate(new Date(value))
  }
  return ""
}

function isoOf(value: unknown) {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string" && value) return new Date(value).toISOString()
  return ""
}

function amountsFrom(doc: Record<string, unknown>): SalaryAmounts {
  return {
    basicSalary: Number(doc.basicSalary ?? 0),
    hra: Number(doc.hra ?? 0),
    allowances: Number(doc.allowances ?? 0),
    bonus: Number(doc.bonus ?? 0),
    deductions: Number(doc.deductions ?? 0),
  }
}

function snapshotLines(lines: { key: string; label: string; amount: number }[]) {
  return lines.map((line) => ({
    key: line.key,
    label: line.label,
    amount: line.amount,
  }))
}

function toPublicStructure(doc: Record<string, unknown>) {
  const employee =
    doc.employeeId && typeof doc.employeeId === "object" && "firstName" in doc.employeeId
      ? toEmployeeCard(doc.employeeId as EmployeeCard)
      : null
  const amounts = amountsFrom(doc)
  const breakdown = computePayroll(amounts)
  const effectiveFrom = dateKeyOf(doc.effectiveFrom)

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    employeeId: employee?.id ?? asId(doc.employeeId),
    employee,
    basicSalary: amounts.basicSalary,
    hra: amounts.hra,
    allowances: amounts.allowances,
    bonus: amounts.bonus,
    deductions: amounts.deductions,
    effectiveFrom,
    effectiveFromLabel: effectiveFrom ? formatShortDate(effectiveFrom) : "",
    breakdown,
    createdAt: isoOf(doc.createdAt),
    updatedAt: isoOf(doc.updatedAt),
  }
}

function toPublicPayroll(doc: Record<string, unknown>) {
  const employee =
    doc.employeeId && typeof doc.employeeId === "object" && "firstName" in doc.employeeId
      ? toEmployeeCard(doc.employeeId as EmployeeCard)
      : null
  const month = Number(doc.month)
  const year = Number(doc.year)
  const generatedAt = isoOf(doc.generatedAt || doc.createdAt)
  const paidAt = doc.paidAt ? isoOf(doc.paidAt) : null

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    employeeId: employee?.id ?? asId(doc.employeeId),
    employee,
    salaryStructureId: doc.salaryStructureId ? asId(doc.salaryStructureId) : null,
    month,
    year,
    periodLabel: periodLabel(year, month),
    currency: PAYROLL_CURRENCY,
    earnings: snapshotLines((doc.earnings as { key: string; label: string; amount: number }[]) ?? []),
    deductions: snapshotLines(
      (doc.deductions as { key: string; label: string; amount: number }[]) ?? []
    ),
    grossSalary: Number(doc.grossSalary ?? 0),
    totalDeductions: Number(doc.totalDeductions ?? 0),
    netSalary: Number(doc.netSalary ?? 0),
    status: String(doc.status ?? "generated"),
    generatedAt,
    generatedLabel: generatedAt ? formatShortDate(generatedAt.slice(0, 10)) : "",
    paidAt,
    paidLabel: paidAt ? formatShortDate(paidAt.slice(0, 10)) : null,
    createdAt: isoOf(doc.createdAt),
    updatedAt: isoOf(doc.updatedAt),
  }
}

async function requireEmployee(organizationId: string, employeeId: string) {
  parseObjectId(employeeId, "Invalid employee")
  const employee = await EmployeeModel.findOne({
    _id: employeeId,
    organizationId,
  }).lean<EmployeeCard>()

  if (!employee) {
    throw AppError.notFound("Employee not found")
  }

  return employee
}

async function structureForPeriod(
  organizationId: string,
  employeeId: string,
  year: number,
  month: number
) {
  const cutoff = utcDateFromKey(lastDateKeyOfMonth(year, month))
  return SalaryStructureModel.findOne({
    organizationId,
    employeeId,
    effectiveFrom: { $lte: cutoff },
  })
    .sort({ effectiveFrom: -1 })
    .lean()
}

async function matchingEmployeeIds(organizationId: string, search?: string) {
  const term = search?.trim()
  if (!term) return null

  const regex = new RegExp(escapeRegex(term), "i")
  const people = await EmployeeModel.find({
    organizationId,
    $or: [{ firstName: regex }, { lastName: regex }, { employeeCode: regex }],
  })
    .select("_id")
    .lean()

  return people.map((person) => person._id)
}

export async function listSalaryStructures(auth: AuthContext, query: StructureListQueryInput) {
  const organizationId = new mongoose.Types.ObjectId(auth.organizationId)
  const filter: Record<string, unknown> = { organizationId }

  if (query.employeeId) {
    parseObjectId(query.employeeId, "Invalid employee")
    filter.employeeId = new mongoose.Types.ObjectId(query.employeeId)
  }

  const matched = await matchingEmployeeIds(auth.organizationId, resolvedSearch(query))
  if (matched) {
    if (query.employeeId && !matched.some((id) => String(id) === query.employeeId)) {
      return { items: [], ...paginationMeta(0, query) }
    }
    if (!query.employeeId) {
      filter.employeeId = { $in: matched }
    }
  }

  if (query.employeeId) {
    const [items, total] = await Promise.all([
      SalaryStructureModel.find(filter)
        .populate(EMPLOYEE_POPULATE)
        .sort(mongoSort(query, { effectiveFrom: -1 }))
        .skip(paginationSkip(query))
        .limit(query.limit)
        .lean(),
      SalaryStructureModel.countDocuments(filter),
    ])

    return {
      items: items.map((item) => toPublicStructure(item as Record<string, unknown>)),
      ...paginationMeta(total, query),
    }
  }

  const grouped = await SalaryStructureModel.aggregate<{
    page: { _id: mongoose.Types.ObjectId; latestId: mongoose.Types.ObjectId }[]
    total: { n: number }[]
  }>([
    { $match: filter },
    { $sort: mongoSort(query, { effectiveFrom: -1, createdAt: -1 }) },
    { $group: { _id: "$employeeId", latestId: { $first: "$_id" } } },
    { $sort: { latestId: -1 } },
    {
      $facet: {
        page: [{ $skip: paginationSkip(query) }, { $limit: query.limit }],
        total: [{ $count: "n" }],
      },
    },
  ])

  const page = grouped[0]?.page ?? []
  const total = grouped[0]?.total[0]?.n ?? 0
  const ids = page.map((row) => row.latestId)
  const items = await SalaryStructureModel.find({ _id: { $in: ids } })
    .populate(EMPLOYEE_POPULATE)
    .lean()
  const byId = new Map(items.map((item) => [String(item._id), item]))

  return {
    items: ids
      .map((id) => byId.get(String(id)))
      .filter(Boolean)
      .map((item) => toPublicStructure(item as Record<string, unknown>)),
    ...paginationMeta(total, query),
  }
}

export async function getSalaryStructure(auth: AuthContext, id: string) {
  parseObjectId(id)
  const doc = await SalaryStructureModel.findOne({
    _id: id,
    organizationId: auth.organizationId,
  })
    .populate(EMPLOYEE_POPULATE)
    .lean()

  if (!doc) {
    throw AppError.notFound(MESSAGES.PAYROLL_STRUCTURE_NOT_FOUND)
  }

  return toPublicStructure(doc as Record<string, unknown>)
}

export async function createSalaryStructure(auth: AuthContext, input: CreateSalaryStructureInput) {
  const employee = await requireEmployee(auth.organizationId, input.employeeId)
  const effectiveFrom = utcDateFromKey(input.effectiveFrom)
  const amounts: SalaryAmounts = {
    basicSalary: input.basicSalary,
    hra: input.hra,
    allowances: input.allowances,
    bonus: input.bonus,
    deductions: input.deductions,
  }

  const existing = await SalaryStructureModel.findOne({
    organizationId: auth.organizationId,
    employeeId: input.employeeId,
    effectiveFrom,
  })

  if (existing) {
    existing.set(amounts)
    await existing.save()
    await existing.populate(EMPLOYEE_POPULATE)
    return toPublicStructure(existing.toObject() as Record<string, unknown>)
  }

  const created = await SalaryStructureModel.create({
    organizationId: auth.organizationId,
    employeeId: input.employeeId,
    effectiveFrom,
    ...amounts,
  })
  await created.populate(EMPLOYEE_POPULATE)
  await recordActivity(auth.organizationId, {
    title: "Salary structure saved",
    detail: `${employeeName(employee)} from ${formatShortDate(input.effectiveFrom)}`,
    tone: "success",
  })

  return toPublicStructure(created.toObject() as Record<string, unknown>)
}

export async function updateSalaryStructure(
  auth: AuthContext,
  id: string,
  input: UpdateSalaryStructureInput
) {
  parseObjectId(id)
  const structure = await SalaryStructureModel.findOne({
    _id: id,
    organizationId: auth.organizationId,
  })

  if (!structure) {
    throw AppError.notFound(MESSAGES.PAYROLL_STRUCTURE_NOT_FOUND)
  }

  if (input.basicSalary !== undefined) structure.basicSalary = input.basicSalary
  if (input.hra !== undefined) structure.hra = input.hra
  if (input.allowances !== undefined) structure.allowances = input.allowances
  if (input.bonus !== undefined) structure.bonus = input.bonus
  if (input.deductions !== undefined) structure.deductions = input.deductions
  if (input.effectiveFrom) {
    structure.effectiveFrom = utcDateFromKey(input.effectiveFrom)
  }

  try {
    await structure.save()
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      throw AppError.conflict(MESSAGES.PAYROLL_STRUCTURE_EXISTS)
    }
    throw error
  }

  await structure.populate(EMPLOYEE_POPULATE)
  return toPublicStructure(structure.toObject() as Record<string, unknown>)
}

function payrollFilter(auth: AuthContext, query: PayrollListQueryInput) {
  const filter: Record<string, unknown> = {
    organizationId: new mongoose.Types.ObjectId(auth.organizationId),
  }
  const now = currentPeriod()
  const scopedToEmployee = Boolean(query.employeeId)
  const month = query.month ?? (scopedToEmployee ? undefined : now.month)
  const year = query.year ?? (scopedToEmployee ? undefined : now.year)

  if (query.employeeId) {
    parseObjectId(query.employeeId, "Invalid employee")
    filter.employeeId = new mongoose.Types.ObjectId(query.employeeId)
  }
  if (month !== undefined) filter.month = month
  if (year !== undefined) filter.year = year
  if (query.status) filter.status = query.status

  return { filter, month, year }
}

export async function listPayrolls(auth: AuthContext, query: PayrollListQueryInput) {
  const { filter, month, year } = payrollFilter(auth, query)
  const matched = await matchingEmployeeIds(auth.organizationId, resolvedSearch(query))

  if (matched) {
    const current = filter.employeeId
    const ids = matched.map((id) => String(id))
    if (typeof current === "string") {
      if (!ids.includes(current)) {
        return emptyPayrollList(query, month, year)
      }
    } else {
      filter.employeeId = { $in: matched }
    }
  }

  const [items, total, aggregates] = await Promise.all([
    PayrollModel.find(filter)
      .populate(EMPLOYEE_POPULATE)
      .sort(mongoSort(query, { year: -1, month: -1, createdAt: -1 }))
      .skip(paginationSkip(query))
      .limit(query.limit)
      .lean(),
    PayrollModel.countDocuments(filter),
    PayrollModel.aggregate<{
      _id: null
      employees: number
      generated: number
      paid: number
      gross: number
      net: number
    }>([
      { $match: filter },
      {
        $group: {
          _id: null,
          employees: { $sum: 1 },
          generated: { $sum: { $cond: [{ $eq: ["$status", "generated"] }, 1, 0] } },
          paid: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
          gross: { $sum: "$grossSalary" },
          net: { $sum: "$netSalary" },
        },
      },
    ]),
  ])

  const stats = aggregates[0]
  return {
    items: items.map((item) => toPublicPayroll(item as Record<string, unknown>)),
    summary: {
      employees: stats?.employees ?? 0,
      generated: stats?.generated ?? 0,
      paid: stats?.paid ?? 0,
      gross: stats?.gross ?? 0,
      net: stats?.net ?? 0,
    },
    month: month ?? null,
    year: year ?? null,
    periodLabel: month && year ? periodLabel(year, month) : null,
    currency: PAYROLL_CURRENCY,
    ...paginationMeta(total, query),
  }
}

function emptyPayrollList(query: PayrollListQueryInput, month?: number, year?: number) {
  return {
    items: [],
    summary: { employees: 0, generated: 0, paid: 0, gross: 0, net: 0 },
    month: month ?? null,
    year: year ?? null,
    periodLabel: month && year ? periodLabel(year, month) : null,
    currency: PAYROLL_CURRENCY,
    ...paginationMeta(0, query),
  }
}

export async function getPayroll(auth: AuthContext, id: string) {
  parseObjectId(id)
  const doc = await PayrollModel.findOne({
    _id: id,
    organizationId: auth.organizationId,
  })
    .populate(EMPLOYEE_POPULATE)
    .lean()

  if (!doc) {
    throw AppError.notFound(MESSAGES.PAYROLL_NOT_FOUND)
  }

  return toPublicPayroll(doc as Record<string, unknown>)
}

export async function previewPayroll(auth: AuthContext, query: PayrollPreviewQueryInput) {
  const employee = await requireEmployee(auth.organizationId, query.employeeId)
  const structure = await structureForPeriod(
    auth.organizationId,
    query.employeeId,
    query.year,
    query.month
  )

  if (!structure) {
    throw AppError.notFound(MESSAGES.PAYROLL_NO_STRUCTURE)
  }

  const existing = await PayrollModel.findOne({
    organizationId: auth.organizationId,
    employeeId: query.employeeId,
    year: query.year,
    month: query.month,
  })
    .select("_id status")
    .lean()

  const amounts = amountsFrom(structure as Record<string, unknown>)
  const breakdown = computePayroll(amounts)

  return {
    employee: toEmployeeCard(employee),
    month: query.month,
    year: query.year,
    periodLabel: periodLabel(query.year, query.month),
    currency: PAYROLL_CURRENCY,
    structure: {
      id: String(structure._id),
      effectiveFrom: dateKeyOf(structure.effectiveFrom),
      ...amounts,
    },
    breakdown,
    existingPayrollId: existing ? String(existing._id) : null,
    existingStatus: existing ? String(existing.status) : null,
  }
}

export async function generatePayroll(auth: AuthContext, input: GeneratePayrollInput) {
  const targeted = input.employeeIds?.length
    ? input.employeeIds.map((id) => {
        parseObjectId(id, "Invalid employee")
        return id
      })
    : null

  const employeeFilter: Record<string, unknown> = {
    organizationId: auth.organizationId,
    employmentStatus: { $in: [...PAYROLL_ELIGIBLE_STATUSES] },
  }
  if (targeted) {
    employeeFilter._id = { $in: targeted }
  }

  const employees = await EmployeeModel.find(employeeFilter)
    .select("firstName lastName profileImage employeeCode departmentId designationId")
    .lean<EmployeeCard[]>()

  const employeeIds = employees.map((employee) => employee._id)
  const skippedInactive = targeted ? targeted.length - employees.length : 0

  if (targeted?.length === 1 && employees.length === 0) {
    throw AppError.badRequest("This employee is not eligible for payroll")
  }

  const existing = await PayrollModel.find({
    organizationId: auth.organizationId,
    year: input.year,
    month: input.month,
    employeeId: { $in: employeeIds },
  })
    .select("employeeId")
    .lean()
  const alreadyPaid = new Set(existing.map((row) => String(row.employeeId)))

  const cutoff = utcDateFromKey(lastDateKeyOfMonth(input.year, input.month))
  const structures = employeeIds.length
    ? await SalaryStructureModel.aggregate<{
        _id: mongoose.Types.ObjectId
        doc: Record<string, unknown>
      }>([
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(auth.organizationId),
            employeeId: { $in: employeeIds },
            effectiveFrom: { $lte: cutoff },
          },
        },
        { $sort: { effectiveFrom: -1, createdAt: -1 } },
        { $group: { _id: "$employeeId", doc: { $first: "$$ROOT" } } },
      ])
    : []
  const structureByEmployee = new Map(
    structures.map((row) => [String(row._id), row.doc])
  )

  const now = new Date()
  const docs: {
    organizationId: string
    employeeId: mongoose.Types.ObjectId
    salaryStructureId: unknown
    month: number
    year: number
    earnings: { key: string; label: string; amount: number }[]
    deductions: { key: string; label: string; amount: number }[]
    grossSalary: number
    totalDeductions: number
    netSalary: number
    status: "generated"
    generatedAt: Date
    generatedBy: string
  }[] = []
  let skippedDuplicates = alreadyPaid.size
  let skippedNoStructure = 0

  for (const employee of employees) {
    const id = String(employee._id)
    if (alreadyPaid.has(id)) continue
    const structure = structureByEmployee.get(id)
    if (!structure) {
      skippedNoStructure += 1
      continue
    }

    const breakdown = computePayroll(amountsFrom(structure))
    docs.push({
      organizationId: auth.organizationId,
      employeeId: employee._id,
      salaryStructureId: structure._id,
      month: input.month,
      year: input.year,
      earnings: snapshotLines(breakdown.earnings),
      deductions: snapshotLines(breakdown.deductions),
      grossSalary: breakdown.grossSalary,
      totalDeductions: breakdown.totalDeductions,
      netSalary: breakdown.netSalary,
      status: "generated",
      generatedAt: now,
      generatedBy: auth.userId,
    })
  }

  if (targeted?.length === 1 && docs.length === 0) {
    if (skippedDuplicates) {
      throw AppError.conflict(MESSAGES.PAYROLL_ALREADY_EXISTS)
    }
    throw AppError.notFound(MESSAGES.PAYROLL_NO_STRUCTURE)
  }

  if (docs.length > 0) {
    try {
      await PayrollModel.insertMany(docs, { ordered: false })
    } catch (error) {
      const isDuplicate =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error.code === 11000 || error.code === 11001)
      if (!isDuplicate) {
        throw error
      }
    }
  }

  const intendedIds = docs.map((doc) => doc.employeeId)
  const populated =
    intendedIds.length > 0
      ? await PayrollModel.find({
          organizationId: auth.organizationId,
          year: input.year,
          month: input.month,
          employeeId: { $in: intendedIds },
          generatedAt: now,
        })
          .populate(EMPLOYEE_POPULATE)
          .lean()
      : []

  if (docs.length > populated.length) {
    skippedDuplicates += docs.length - populated.length
  }

  if (populated.length > 0) {
    await recordActivity(auth.organizationId, {
      title: "Payroll generated",
      detail: `${populated.length} ${populated.length === 1 ? "payslip" : "payslips"} for ${periodLabel(input.year, input.month)}`,
      tone: "success",
    })
  }

  return {
    created: populated.length,
    skippedDuplicates,
    skippedNoStructure,
    skippedInactive,
    month: input.month,
    year: input.year,
    periodLabel: periodLabel(input.year, input.month),
    items: populated.map((item) => toPublicPayroll(item as Record<string, unknown>)),
  }
}

export async function markPayrollPaid(auth: AuthContext, id: string) {
  parseObjectId(id)
  const payroll = await PayrollModel.findOne({
    _id: id,
    organizationId: auth.organizationId,
  })

  if (!payroll) {
    throw AppError.notFound(MESSAGES.PAYROLL_NOT_FOUND)
  }

  if (payroll.status === "paid") {
    throw AppError.conflict(MESSAGES.PAYROLL_ALREADY_PAID)
  }

  payroll.status = "paid"
  payroll.paidAt = new Date()
  payroll.set("paidBy", auth.userId)
  await payroll.save()
  await payroll.populate(EMPLOYEE_POPULATE)

  const publicPayroll = toPublicPayroll(payroll.toObject() as Record<string, unknown>)
  await recordActivity(auth.organizationId, {
    title: "Payroll marked paid",
    detail: `${publicPayroll.employee?.name ?? "Employee"} · ${publicPayroll.periodLabel}`,
    tone: "success",
  })

  return publicPayroll
}

export async function getPayslip(auth: AuthContext, id: string) {
  const payroll = await getPayroll(auth, id)
  const organization = await OrganizationModel.findById(auth.organizationId)
    .select("name email phone address logo")
    .lean()

  const address = organization?.address
  return {
    payroll,
    organization: {
      name: organization?.name ?? "",
      email: organization?.email ?? "",
      phone: organization?.phone ?? "",
      logo: organization?.logo ?? "",
      address: {
        line1: address?.line1 ?? "",
        line2: address?.line2 ?? "",
        city: address?.city ?? "",
        state: address?.state ?? "",
        postalCode: address?.postalCode ?? "",
        country: address?.country ?? "",
      },
    },
  }
}
