import mongoose from "mongoose"

import { MESSAGES } from "../constants/messages.js"
import { PERMISSIONS } from "../constants/permissions.js"
import { statusFromProgress, type GoalStatus } from "../constants/performance.js"
import { EmployeeModel } from "../models/employee.model.js"
import { GoalModel } from "../models/goal.model.js"
import { OrganizationModel } from "../models/organization.model.js"
import { PerformanceReviewModel } from "../models/performance-review.model.js"
import type { AuthContext } from "../types/auth.js"
import { hasAnyPermission } from "../utils/access.js"
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
import { applySearch, mongoSort, resolvedSearch } from "../utils/search.js"
import type {
  CreateGoalInput,
  CreateReviewInput,
  GoalListQueryInput,
  OverviewQueryInput,
  ReviewListQueryInput,
  UpdateGoalInput,
  UpdateGoalProgressInput,
  UpdateReviewInput,
} from "../validators/performance.validators.js"

const DEFAULT_TIMEZONE = "Asia/Kolkata"

type EmployeeCard = {
  _id: mongoose.Types.ObjectId
  firstName: string
  lastName: string
  profileImage?: string
  employeeCode?: string
  userId?: mongoose.Types.ObjectId
  managerId?: mongoose.Types.ObjectId | null
  departmentId?: { name?: string } | mongoose.Types.ObjectId | null
}

const EMPLOYEE_SELECT = "firstName lastName profileImage employeeCode userId managerId departmentId"

const GOAL_POPULATE = {
  path: "employeeId",
  select: EMPLOYEE_SELECT,
  populate: { path: "departmentId", select: "name" },
} as const

const REVIEW_POPULATE = [
  {
    path: "employeeId",
    select: EMPLOYEE_SELECT,
    populate: { path: "departmentId", select: "name" },
  },
  {
    path: "reviewerId",
    select: EMPLOYEE_SELECT,
    populate: { path: "departmentId", select: "name" },
  },
] as const

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

  return {
    id: String(employee._id),
    name,
    initials: initialsFromName(name),
    profileImage: employee.profileImage ?? "",
    employeeCode: employee.employeeCode ?? "",
    department,
  }
}

function isDuplicateKey(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000
}

async function orgTimezone(organizationId: string) {
  const organization = await OrganizationModel.findById(organizationId).select("timezone").lean()
  return organization?.timezone || DEFAULT_TIMEZONE
}

function currentReviewPeriod(todayKey: string) {
  const year = Number(todayKey.slice(0, 4))
  const month = Number(todayKey.slice(5, 7))
  const quarter = Math.min(4, Math.max(1, Math.ceil(month / 3)))
  return `${year}-Q${quarter}`
}

function toPublicGoal(doc: Record<string, unknown>, todayKey: string) {
  const employee =
    doc.employeeId && typeof doc.employeeId === "object" && "firstName" in doc.employeeId
      ? toEmployeeCard(doc.employeeId as EmployeeCard)
      : null
  const deadline = doc.deadline instanceof Date ? dateKeyFromDate(doc.deadline) : null
  const status = String(doc.status)
  const overdue =
    Boolean(deadline) &&
    deadline! < todayKey &&
    status !== "completed" &&
    status !== "cancelled"

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    employeeId: employee?.id ?? asId(doc.employeeId),
    employee,
    title: String(doc.title ?? ""),
    description: String(doc.description ?? ""),
    progress: Number(doc.progress ?? 0),
    deadline,
    deadlineLabel: deadline ? formatShortDate(deadline) : null,
    status,
    overdue,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt ?? ""),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt ?? ""),
  }
}

function toPublicReview(doc: Record<string, unknown>) {
  const employee =
    doc.employeeId && typeof doc.employeeId === "object" && "firstName" in doc.employeeId
      ? toEmployeeCard(doc.employeeId as EmployeeCard)
      : null
  const reviewer =
    doc.reviewerId && typeof doc.reviewerId === "object" && "firstName" in doc.reviewerId
      ? toEmployeeCard(doc.reviewerId as EmployeeCard)
      : null

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    employeeId: employee?.id ?? asId(doc.employeeId),
    employee,
    reviewerId: reviewer?.id ?? asId(doc.reviewerId),
    reviewer,
    kind: String(doc.kind),
    reviewPeriod: String(doc.reviewPeriod ?? ""),
    rating: typeof doc.rating === "number" ? doc.rating : null,
    strengths: String(doc.strengths ?? ""),
    improvements: String(doc.improvements ?? ""),
    feedback: String(doc.feedback ?? ""),
    status: String(doc.status),
    submittedAt: doc.submittedAt instanceof Date ? doc.submittedAt.toISOString() : null,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt ?? ""),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt ?? ""),
  }
}

async function performanceEmployeeFilter(auth: AuthContext) {
  if (hasAnyPermission(auth.role, [PERMISSIONS.PERFORMANCE_READ, PERMISSIONS.PERFORMANCE_MANAGE])) {
    return { organizationId: auth.organizationId } as Record<string, unknown>
  }

  if (hasAnyPermission(auth.role, [PERMISSIONS.PERFORMANCE_READ_TEAM])) {
    const mine = await EmployeeModel.findOne({
      organizationId: auth.organizationId,
      userId: auth.userId,
    })
      .select("_id")
      .lean()

    return {
      organizationId: auth.organizationId,
      $or: mine ? [{ userId: auth.userId }, { managerId: mine._id }] : [{ userId: auth.userId }],
    } as Record<string, unknown>
  }

  if (hasAnyPermission(auth.role, [PERMISSIONS.PERFORMANCE_READ_SELF])) {
    return { organizationId: auth.organizationId, userId: auth.userId } as Record<string, unknown>
  }

  throw AppError.forbidden()
}

async function requireMyEmployee(auth: AuthContext) {
  const employee = await EmployeeModel.findOne({
    organizationId: auth.organizationId,
    userId: auth.userId,
  }).lean<EmployeeCard>()

  if (!employee) {
    throw AppError.notFound(MESSAGES.NO_EMPLOYEE_PROFILE)
  }

  return employee
}

async function scopedEmployeeIds(auth: AuthContext, employeeId?: string) {
  const filter = await performanceEmployeeFilter(auth)
  const employees = await EmployeeModel.find(filter).select("_id").lean()
  let ids = employees.map((row) => row._id)

  if (employeeId) {
    parseObjectId(employeeId)
    ids = ids.filter((id) => String(id) === employeeId)
    if (ids.length === 0) {
      throw AppError.forbidden()
    }
  }

  return ids
}

async function assertEmployeeInScope(auth: AuthContext, employeeId: string) {
  parseObjectId(employeeId)
  const filter = await performanceEmployeeFilter(auth)
  const employee = await EmployeeModel.findOne({ ...filter, _id: employeeId }).lean<EmployeeCard>()
  if (!employee) {
    throw AppError.forbidden()
  }
  return employee
}

async function myEmployeeOrNull(auth: AuthContext) {
  return EmployeeModel.findOne({
    organizationId: auth.organizationId,
    userId: auth.userId,
  })
    .select("_id")
    .lean()
}

function canSeeAllDrafts(auth: AuthContext) {
  return hasAnyPermission(auth.role, [PERMISSIONS.PERFORMANCE_READ, PERMISSIONS.PERFORMANCE_MANAGE])
}

async function assertCanWriteGoals(auth: AuthContext, employee: EmployeeCard) {
  if (asId(employee.userId) === auth.userId) {
    return
  }

  if (hasAnyPermission(auth.role, [PERMISSIONS.PERFORMANCE_MANAGE])) {
    return
  }

  if (hasAnyPermission(auth.role, [PERMISSIONS.PERFORMANCE_READ_TEAM])) {
    const mine = await myEmployeeOrNull(auth)
    if (mine && asId(employee.managerId) === String(mine._id)) {
      return
    }
  }

  throw AppError.forbidden()
}

async function assertCanWriteManagerReview(auth: AuthContext, employee: EmployeeCard) {
  if (asId(employee.userId) === auth.userId) {
    throw AppError.forbidden(MESSAGES.REVIEW_CANNOT_REVIEW_SELF)
  }

  if (hasAnyPermission(auth.role, [PERMISSIONS.PERFORMANCE_MANAGE])) {
    return
  }

  if (hasAnyPermission(auth.role, [PERMISSIONS.PERFORMANCE_READ_TEAM])) {
    const mine = await myEmployeeOrNull(auth)
    if (mine && asId(employee.managerId) === String(mine._id)) {
      return
    }
  }

  throw AppError.forbidden()
}

function reviewVisibilityFilter(auth: AuthContext, reviewerId?: mongoose.Types.ObjectId): Record<string, unknown> {
  if (canSeeAllDrafts(auth) || !reviewerId) {
    return {}
  }

  return {
    $or: [{ status: "submitted" as const }, { reviewerId }],
  }
}

async function loadGoal(auth: AuthContext, id: string) {
  parseObjectId(id)
  const timezone = await orgTimezone(auth.organizationId)
  const todayKey = dateKeyInTimeZone(new Date(), timezone)
  const doc = await GoalModel.findOne({ _id: id, organizationId: auth.organizationId })
    .populate(GOAL_POPULATE)
    .lean()

  if (!doc) {
    throw AppError.notFound(MESSAGES.GOAL_NOT_FOUND)
  }

  await assertEmployeeInScope(auth, asId(doc.employeeId))
  return { doc, todayKey }
}

async function loadReview(auth: AuthContext, id: string) {
  parseObjectId(id)
  const mine = await myEmployeeOrNull(auth)
  const doc = await PerformanceReviewModel.findOne({
    _id: id,
    organizationId: auth.organizationId,
  })
    .populate([...REVIEW_POPULATE])
    .lean()

  if (!doc) {
    throw AppError.notFound(MESSAGES.REVIEW_NOT_FOUND)
  }

  await assertEmployeeInScope(auth, asId(doc.employeeId))

  if (doc.status === "draft" && !canSeeAllDrafts(auth) && asId(doc.reviewerId) !== String(mine?._id ?? "")) {
    throw AppError.notFound(MESSAGES.REVIEW_NOT_FOUND)
  }

  return { doc, mine }
}

export async function getOverview(auth: AuthContext, query: OverviewQueryInput) {
  const timezone = await orgTimezone(auth.organizationId)
  const todayKey = dateKeyInTimeZone(new Date(), timezone)
  const mine = await requireMyEmployee(auth)
  const subjectId = query.employeeId ?? String(mine._id)
  const employee = await assertEmployeeInScope(auth, subjectId)
  const employeeIds = [employee._id]
  const isSelf = asId(employee.userId) === auth.userId
  const isDirectReport = asId(employee.managerId) === String(mine._id)

  const [goals, reviews] = await Promise.all([
    GoalModel.find({ organizationId: auth.organizationId, employeeId: { $in: employeeIds } }).lean(),
    PerformanceReviewModel.find({
      organizationId: auth.organizationId,
      employeeId: { $in: employeeIds },
      ...reviewVisibilityFilter(auth, mine._id),
    })
      .populate([...REVIEW_POPULATE])
      .sort({ reviewPeriod: -1, submittedAt: -1, createdAt: -1 })
      .lean(),
  ])

  const activeGoals = goals.filter((goal) => goal.status !== "cancelled")
  const avgProgress =
    activeGoals.length === 0
      ? 0
      : Math.round(activeGoals.reduce((sum, goal) => sum + (goal.progress ?? 0), 0) / activeGoals.length)

  const overdue = goals.filter((goal) => {
    if (!goal.deadline || goal.status === "completed" || goal.status === "cancelled") return false
    return dateKeyFromDate(goal.deadline) < todayKey
  }).length

  const submitted = reviews.filter((review) => review.status === "submitted" && typeof review.rating === "number")
  const managerSubmitted = submitted.filter((review) => review.kind === "manager")
  const ratingSource = managerSubmitted.length > 0 ? managerSubmitted : submitted
  const averageRating =
    ratingSource.length === 0
      ? null
      : Math.round((ratingSource.reduce((sum, review) => sum + (review.rating ?? 0), 0) / ratingSource.length) * 10) /
        10

  const distribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: ratingSource.filter((review) => review.rating === rating).length,
  }))

  const historyMap = new Map<string, { period: string; manager: number | null; self: number | null }>()
  for (const review of submitted) {
    const existing = historyMap.get(review.reviewPeriod) ?? {
      period: review.reviewPeriod,
      manager: null,
      self: null,
    }
    if (review.kind === "manager") existing.manager = review.rating ?? null
    if (review.kind === "self") existing.self = review.rating ?? null
    historyMap.set(review.reviewPeriod, existing)
  }
  const history = [...historyMap.values()].sort((a, b) => a.period.localeCompare(b.period))

  const latestDoc = ratingSource.length > 0 ? latestRatingDoc(ratingSource) : null
  const latest = latestDoc
    ? {
        rating: latestRating(latestDoc),
        period: String(latestDoc.reviewPeriod),
        kind: String(latestDoc.kind),
      }
    : null

  let team: {
    reports: number
    avgProgress: number
    reviewsSubmitted: number
  } | null = null

  const showTeam =
    isSelf &&
    hasAnyPermission(auth.role, [
      PERMISSIONS.PERFORMANCE_READ,
      PERMISSIONS.PERFORMANCE_READ_TEAM,
      PERMISSIONS.PERFORMANCE_MANAGE,
    ])

  if (showTeam) {
    const reports = await EmployeeModel.find({
      organizationId: auth.organizationId,
      managerId: mine._id,
    })
      .select("_id")
      .lean()
    const reportIds = reports.map((row) => row._id)
    if (reportIds.length > 0) {
      const [teamGoals, teamReviews] = await Promise.all([
        GoalModel.find({
          organizationId: auth.organizationId,
          employeeId: { $in: reportIds },
          status: { $ne: "cancelled" },
        })
          .select("progress")
          .lean(),
        PerformanceReviewModel.countDocuments({
          organizationId: auth.organizationId,
          employeeId: { $in: reportIds },
          kind: "manager",
          status: "submitted",
          reviewPeriod: currentReviewPeriod(todayKey),
        }),
      ])
      team = {
        reports: reportIds.length,
        avgProgress:
          teamGoals.length === 0
            ? 0
            : Math.round(teamGoals.reduce((sum, goal) => sum + (goal.progress ?? 0), 0) / teamGoals.length),
        reviewsSubmitted: teamReviews,
      }
    } else {
      team = { reports: 0, avgProgress: 0, reviewsSubmitted: 0 }
    }
  }

  return {
    employee: toEmployeeCard(employee),
    myEmployeeId: String(mine._id),
    currentPeriod: currentReviewPeriod(todayKey),
    isSelf,
    canPickEmployee: hasAnyPermission(auth.role, [
      PERMISSIONS.PERFORMANCE_READ,
      PERMISSIONS.PERFORMANCE_READ_TEAM,
      PERMISSIONS.PERFORMANCE_MANAGE,
    ]),
    canWriteGoals: isSelf || hasAnyPermission(auth.role, [PERMISSIONS.PERFORMANCE_MANAGE]) || isDirectReport,
    canWriteSelfReview: isSelf,
    canWriteManagerReview:
      !isSelf && (hasAnyPermission(auth.role, [PERMISSIONS.PERFORMANCE_MANAGE]) || isDirectReport),
    goals: {
      total: goals.length,
      notStarted: goals.filter((goal) => goal.status === "not_started").length,
      inProgress: goals.filter((goal) => goal.status === "in_progress").length,
      completed: goals.filter((goal) => goal.status === "completed").length,
      cancelled: goals.filter((goal) => goal.status === "cancelled").length,
      avgProgress,
      overdue,
    },
    ratings: {
      average: averageRating,
      count: ratingSource.length,
      latest,
      distribution,
      history,
    },
    recentReviews: reviews.slice(0, 6).map((item) => toPublicReview(item as Record<string, unknown>)),
    team,
  }
}

function latestRatingDoc(reviews: Array<{ submittedAt?: Date | null; createdAt?: Date; rating?: number | null; reviewPeriod: string; kind: string }>) {
  return [...reviews].sort((a, b) => {
    const aTime = (a.submittedAt ?? a.createdAt)?.getTime() ?? 0
    const bTime = (b.submittedAt ?? b.createdAt)?.getTime() ?? 0
    return bTime - aTime
  })[0]
}

function latestRating(doc: { rating?: number | null }) {
  return typeof doc.rating === "number" ? doc.rating : null
}

export async function listGoals(auth: AuthContext, query: GoalListQueryInput) {
  const timezone = await orgTimezone(auth.organizationId)
  const todayKey = dateKeyInTimeZone(new Date(), timezone)
  const employeeIds = await scopedEmployeeIds(auth, query.employeeId)

  const filter: Record<string, unknown> = {
    organizationId: auth.organizationId,
    employeeId: { $in: employeeIds },
  }
  if (query.status) filter.status = query.status
  applySearch(filter, ["title", "description"], resolvedSearch(query))

  const pagination = { page: query.page, limit: query.limit }
  const [items, total] = await Promise.all([
    GoalModel.find(filter)
      .populate(GOAL_POPULATE)
      .sort(mongoSort(query, { deadline: 1, createdAt: -1 }))
      .skip(paginationSkip(pagination))
      .limit(pagination.limit)
      .lean(),
    GoalModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicGoal(item as Record<string, unknown>, todayKey)),
    ...paginationMeta(total, pagination),
  }
}

export async function getGoal(auth: AuthContext, id: string) {
  const { doc, todayKey } = await loadGoal(auth, id)
  return toPublicGoal(doc as Record<string, unknown>, todayKey)
}

export async function createGoal(auth: AuthContext, input: CreateGoalInput) {
  const mine = await requireMyEmployee(auth)
  const employeeId = input.employeeId ?? String(mine._id)
  const employee = await assertEmployeeInScope(auth, employeeId)
  await assertCanWriteGoals(auth, employee)

  const timezone = await orgTimezone(auth.organizationId)
  const todayKey = dateKeyInTimeZone(new Date(), timezone)
  const progress = input.progress ?? 0
  const status = input.status ?? statusFromProgress(progress)

  const created = await GoalModel.create({
    organizationId: auth.organizationId,
    employeeId,
    title: input.title,
    description: input.description ?? "",
    progress,
    deadline: input.deadline ? utcDateFromKey(input.deadline) : null,
    status,
  })

  await recordActivity(auth.organizationId, {
    title: `Goal added for ${employeeName(employee)}`,
    detail: input.title,
  })

  const populated = await GoalModel.findById(created._id).populate(GOAL_POPULATE).lean()
  return toPublicGoal(populated as Record<string, unknown>, todayKey)
}

export async function updateGoal(auth: AuthContext, id: string, input: UpdateGoalInput) {
  const { doc, todayKey } = await loadGoal(auth, id)
  const employee = await assertEmployeeInScope(auth, asId(doc.employeeId))
  await assertCanWriteGoals(auth, employee)

  const nextProgress = input.progress ?? Number(doc.progress ?? 0)
  const nextStatus =
    input.status ?? statusFromProgress(nextProgress, String(doc.status) as GoalStatus)

  const updated = await GoalModel.findByIdAndUpdate(
    id,
    {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.progress !== undefined ? { progress: input.progress } : {}),
      ...(input.deadline !== undefined
        ? { deadline: input.deadline ? utcDateFromKey(input.deadline) : null }
        : {}),
      status: nextStatus,
    },
    { new: true }
  )
    .populate(GOAL_POPULATE)
    .lean()

  return toPublicGoal(updated as Record<string, unknown>, todayKey)
}

export async function updateGoalProgress(auth: AuthContext, id: string, input: UpdateGoalProgressInput) {
  const { doc, todayKey } = await loadGoal(auth, id)
  const employee = await assertEmployeeInScope(auth, asId(doc.employeeId))
  await assertCanWriteGoals(auth, employee)

  if (String(doc.status) === "cancelled") {
    throw AppError.badRequest("Cancelled goals cannot be updated")
  }

  const status = statusFromProgress(input.progress, String(doc.status) as GoalStatus)
  const updated = await GoalModel.findByIdAndUpdate(
    id,
    { progress: input.progress, status },
    { new: true }
  )
    .populate(GOAL_POPULATE)
    .lean()

  return toPublicGoal(updated as Record<string, unknown>, todayKey)
}

export async function deleteGoal(auth: AuthContext, id: string) {
  const { doc } = await loadGoal(auth, id)
  const employee = await assertEmployeeInScope(auth, asId(doc.employeeId))
  await assertCanWriteGoals(auth, employee)
  await GoalModel.deleteOne({ _id: id, organizationId: auth.organizationId })
}

export async function listReviews(auth: AuthContext, query: ReviewListQueryInput) {
  const mine = await myEmployeeOrNull(auth)
  const employeeIds = await scopedEmployeeIds(auth, query.employeeId)
  const filter: Record<string, unknown> = {
    organizationId: auth.organizationId,
    employeeId: { $in: employeeIds },
    ...reviewVisibilityFilter(auth, mine?._id),
  }
  if (query.kind) filter.kind = query.kind
  if (query.status) filter.status = query.status
  if (query.reviewPeriod) filter.reviewPeriod = query.reviewPeriod

  applySearch(filter, ["strengths", "improvements", "feedback"], resolvedSearch(query))

  const pagination = { page: query.page, limit: query.limit }
  const [items, total] = await Promise.all([
    PerformanceReviewModel.find(filter)
      .populate([...REVIEW_POPULATE])
      .sort(mongoSort(query, { reviewPeriod: -1, createdAt: -1 }))
      .skip(paginationSkip(pagination))
      .limit(pagination.limit)
      .lean(),
    PerformanceReviewModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicReview(item as Record<string, unknown>)),
    ...paginationMeta(total, pagination),
  }
}

export async function getReview(auth: AuthContext, id: string) {
  const { doc } = await loadReview(auth, id)
  return toPublicReview(doc as Record<string, unknown>)
}

export async function createReview(auth: AuthContext, input: CreateReviewInput) {
  const mine = await requireMyEmployee(auth)
  const employeeId = input.employeeId ?? String(mine._id)
  const employee = await assertEmployeeInScope(auth, employeeId)
  const isSelf = String(employee._id) === String(mine._id)
  const kind = input.kind ?? (isSelf ? "self" : "manager")

  if (kind === "self") {
    if (!isSelf) {
      throw AppError.forbidden()
    }
  } else {
    await assertCanWriteManagerReview(auth, employee)
  }

  try {
    const created = await PerformanceReviewModel.create({
      organizationId: auth.organizationId,
      employeeId,
      reviewerId: mine._id,
      kind,
      reviewPeriod: input.reviewPeriod,
      rating: input.rating ?? null,
      strengths: input.strengths ?? "",
      improvements: input.improvements ?? "",
      feedback: input.feedback ?? "",
      status: "draft",
    })

    const populated = await PerformanceReviewModel.findById(created._id)
      .populate([...REVIEW_POPULATE])
      .lean()
    return toPublicReview(populated as Record<string, unknown>)
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw AppError.conflict(MESSAGES.REVIEW_EXISTS)
    }
    throw error
  }
}

export async function updateReview(auth: AuthContext, id: string, input: UpdateReviewInput) {
  const { doc, mine } = await loadReview(auth, id)

  if (String(doc.status) !== "draft") {
    throw AppError.badRequest(MESSAGES.REVIEW_NOT_DRAFT)
  }

  if (asId(doc.reviewerId) !== String(mine?._id ?? "") && !hasAnyPermission(auth.role, [PERMISSIONS.PERFORMANCE_MANAGE])) {
    throw AppError.forbidden()
  }

  const updated = await PerformanceReviewModel.findByIdAndUpdate(
    id,
    {
      ...(input.reviewPeriod !== undefined ? { reviewPeriod: input.reviewPeriod } : {}),
      ...(input.rating !== undefined ? { rating: input.rating } : {}),
      ...(input.strengths !== undefined ? { strengths: input.strengths } : {}),
      ...(input.improvements !== undefined ? { improvements: input.improvements } : {}),
      ...(input.feedback !== undefined ? { feedback: input.feedback } : {}),
    },
    { new: true }
  )
    .populate([...REVIEW_POPULATE])
    .lean()

  return toPublicReview(updated as Record<string, unknown>)
}

export async function submitReview(auth: AuthContext, id: string) {
  const { doc, mine } = await loadReview(auth, id)

  if (String(doc.status) !== "draft") {
    throw AppError.badRequest(MESSAGES.REVIEW_NOT_DRAFT)
  }

  if (asId(doc.reviewerId) !== String(mine?._id ?? "") && !hasAnyPermission(auth.role, [PERMISSIONS.PERFORMANCE_MANAGE])) {
    throw AppError.forbidden()
  }

  if (typeof doc.rating !== "number") {
    throw AppError.badRequest(MESSAGES.REVIEW_RATING_REQUIRED)
  }

  const updated = await PerformanceReviewModel.findByIdAndUpdate(
    id,
    { status: "submitted", submittedAt: new Date() },
    { new: true }
  )
    .populate([...REVIEW_POPULATE])
    .lean()

  const employeeNameLabel =
    updated && typeof updated.employeeId === "object" && updated.employeeId && "firstName" in updated.employeeId
      ? employeeName(updated.employeeId as unknown as EmployeeCard)
      : "Employee"

  await recordActivity(auth.organizationId, {
    title: `${doc.kind === "self" ? "Self-review" : "Manager review"} submitted`,
    detail: `${employeeNameLabel} · ${String(doc.reviewPeriod)}`,
  })

  return toPublicReview(updated as Record<string, unknown>)
}
