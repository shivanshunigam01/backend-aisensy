import mongoose from "mongoose"

import { CandidateEvaluationModel } from "../models/candidate-evaluation.model.js"
import { CandidateSubmissionModel } from "../models/candidate-submission.model.js"
import { CandidateModel } from "../models/candidate.model.js"
import { ClientModel } from "../models/client.model.js"
import { GuaranteeFollowUpModel } from "../models/guarantee-follow-up.model.js"
import { InterviewModel } from "../models/interview.model.js"
import { InvoiceModel } from "../models/invoice.model.js"
import { JoiningModel } from "../models/joining.model.js"
import { OfferModel } from "../models/offer.model.js"
import { RecruitmentMandateModel } from "../models/recruitment-mandate.model.js"
import { UserModel } from "../models/user.model.js"
import type { AuthContext } from "../types/auth.js"
import { AppError } from "../utils/app-error.js"
import { addUtcDays, utcDateFromKey } from "../utils/dates.js"
import { parseObjectId } from "../utils/object-id.js"
import type { RecruitmentDashboardQueryInput } from "../validators/recruitment-dashboard.validators.js"

const MS_PER_DAY = 86_400_000
const SUBMITTED_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "REJECTED", "WITHDRAWN"]
const DROPOUT_STATUSES = ["NO_SHOW", "WITHDRAWN"]
const JOINING_OUTCOME_STATUSES = ["JOINED", "NO_SHOW", "WITHDRAWN"]
const RETENTION_OUTCOME_STATUSES = ["RETAINED", "REPLACED", "DROPPED"]

type DateRange = { fromDate?: Date; toExclusive?: Date }

function asObjectId(id: string) {
  return new mongoose.Types.ObjectId(id)
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

function ratioPercent(numerator: number, denominator: number) {
  if (!denominator) return null
  return round1((numerator / denominator) * 100)
}

function dateFilter(field: string, range: DateRange) {
  if (!range.fromDate && !range.toExclusive) return {}
  const clause: Record<string, Date> = {}
  if (range.fromDate) clause.$gte = range.fromDate
  if (range.toExclusive) clause.$lt = range.toExclusive
  return { [field]: clause }
}

function avgOf(rows: Array<{ avg?: number }> | undefined) {
  const avg = rows?.[0]?.avg
  if (typeof avg !== "number" || Number.isNaN(avg)) return null
  return round1(Math.max(0, avg))
}

/**
 * KPI formulas (recruitment dashboard):
 * - candidatesSourced: candidates created in range (optionally linked to scoped mandates)
 * - candidatesScreened: evaluations in range
 * - candidatesSubmitted: introduced submissions in range
 * - interviewsScheduled: non-cancelled interviews in range
 * - offersPending: offers with status SENT in range
 * - candidatesJoined: joinings with status JOINED in range
 * - timeToFirstSubmissionDays: avg (min submission.submittedAt − mandate.createdAt) days
 * - timeToFillDays: avg (joining.joiningDate − mandate.createdAt) for JOINED
 * - submissionToInterviewPercent: interviews / submissions × 100
 * - interviewToOfferPercent: non-draft/withdrawn offers / interviews × 100
 * - offerToJoinPercent: joined / accepted offers × 100
 * - joiningDropoutPercent: (NO_SHOW + WITHDRAWN) / joining outcomes × 100
 * - retention90DayPercent: RETAINED / retention outcomes × 100
 * - revenue: sum of invoice.paidAmount (non-cancelled) in range
 * - outstandingReceivables: sum of invoice.outstandingAmount in range
 * - revenuePerRecruiter: paid invoice amounts attributed to submission.submittedBy
 *   via joining → offer → submission (fallback: mandate assigned recruiter)
 */
function emptyMetrics() {
  return {
    activeClients: 0,
    openMandates: 0,
    totalCandidates: 0,
    candidatesSourced: 0,
    candidatesScreened: 0,
    candidatesSubmitted: 0,
    interviewsScheduled: 0,
    offersPending: 0,
    candidatesJoined: 0,
    timeToFirstSubmissionDays: null as number | null,
    timeToFillDays: null as number | null,
    submissionToInterviewPercent: null as number | null,
    interviewToOfferPercent: null as number | null,
    offerToJoinPercent: null as number | null,
    joiningDropoutPercent: null as number | null,
    retention90DayPercent: null as number | null,
    revenue: 0,
    outstandingReceivables: 0,
    revenuePerRecruiter: [] as Array<{ recruiterId: string; name: string; revenue: number }>,
  }
}

async function resolveMandateIds(
  organizationId: mongoose.Types.ObjectId,
  query: RecruitmentDashboardQueryInput
) {
  const needsMandateScope = Boolean(query.clientId || query.recruiterId || query.mandateId)
  if (!needsMandateScope) return undefined

  const filter: Record<string, unknown> = { organizationId }
  if (query.clientId) {
    parseObjectId(query.clientId, "Invalid client")
    filter.clientId = query.clientId
  }
  if (query.mandateId) {
    parseObjectId(query.mandateId, "Invalid mandate")
    filter._id = query.mandateId
  }
  if (query.recruiterId) {
    parseObjectId(query.recruiterId, "Invalid recruiter")
    filter.assignedRecruiters = query.recruiterId
  }

  return RecruitmentMandateModel.find(filter).distinct("_id")
}

function scopedFilter(
  organizationId: mongoose.Types.ObjectId,
  mandateIds: mongoose.Types.ObjectId[] | undefined,
  extra: Record<string, unknown> = {}
) {
  const filter: Record<string, unknown> = { organizationId, ...extra }
  if (mandateIds) filter.mandateId = { $in: mandateIds }
  return filter
}

async function averageCycleDays(
  organizationId: mongoose.Types.ObjectId,
  mandateIds: mongoose.Types.ObjectId[] | undefined,
  source: "submission" | "joining",
  range: DateRange
) {
  const match: Record<string, unknown> = { organizationId }
  if (mandateIds) match.mandateId = { $in: mandateIds }

  if (source === "submission") {
    match.status = { $in: SUBMITTED_STATUSES }
    Object.assign(match, dateFilter("submittedAt", range))
    match.submittedAt = match.submittedAt ?? { $ne: null }
  } else {
    match.status = "JOINED"
    Object.assign(match, dateFilter("joiningDate", range))
  }

  const dateField = source === "submission" ? "$submittedAt" : "$joiningDate"
  const Model = source === "submission" ? CandidateSubmissionModel : JoiningModel

  const rows = await Model.aggregate<{ avg?: number }>([
    { $match: match },
    { $group: { _id: "$mandateId", eventAt: { $min: dateField } } },
    {
      $lookup: {
        from: RecruitmentMandateModel.collection.name,
        localField: "_id",
        foreignField: "_id",
        as: "mandate",
      },
    },
    { $unwind: "$mandate" },
    {
      $project: {
        days: {
          $divide: [{ $subtract: ["$eventAt", "$mandate.createdAt"] }, MS_PER_DAY],
        },
      },
    },
    { $match: { days: { $gte: 0 } } },
    { $group: { _id: null, avg: { $avg: "$days" } } },
  ])

  return avgOf(rows)
}

export async function getRecruitmentDashboard(
  auth: AuthContext,
  query: RecruitmentDashboardQueryInput
) {
  if (query.from) utcDateFromKey(query.from)
  if (query.to) utcDateFromKey(query.to)
  if (query.from && query.to && query.from > query.to) {
    throw AppError.badRequest("Start date must be on or before the end date")
  }

  const organizationId = asObjectId(auth.organizationId)
  const range: DateRange = {
    fromDate: query.from ? utcDateFromKey(query.from) : undefined,
    toExclusive: query.to ? addUtcDays(utcDateFromKey(query.to), 1) : undefined,
  }

  const mandateIds = await resolveMandateIds(organizationId, query)
  const filters = {
    from: query.from ?? "",
    to: query.to ?? "",
    clientId: query.clientId ?? "",
    recruiterId: query.recruiterId ?? "",
    mandateId: query.mandateId ?? "",
  }

  if (mandateIds && mandateIds.length === 0) {
    return { filters, metrics: emptyMetrics() }
  }

  const clientMatch: Record<string, unknown> = { organizationId, status: "ACTIVE" }
  if (query.clientId) clientMatch._id = query.clientId
  else if (mandateIds) {
    const clientIds = await RecruitmentMandateModel.find({ _id: { $in: mandateIds } }).distinct(
      "clientId"
    )
    clientMatch._id = { $in: clientIds }
  }

  const mandateMatch = scopedFilter(organizationId, mandateIds, { status: "OPEN" })
  if (query.clientId && !mandateIds) mandateMatch.clientId = query.clientId

  const evaluationMatch = {
    ...scopedFilter(organizationId, mandateIds),
    ...dateFilter("evaluatedAt", range),
  }

  const submissionMatch = {
    ...scopedFilter(organizationId, mandateIds, { status: { $in: SUBMITTED_STATUSES } }),
    ...dateFilter("submittedAt", range),
  }
  if (query.clientId) submissionMatch.clientId = query.clientId

  const interviewMatch = {
    ...scopedFilter(organizationId, mandateIds, { status: { $ne: "CANCELLED" } }),
    ...dateFilter("scheduledAt", range),
  }

  const offerPendingMatch = {
    ...scopedFilter(organizationId, mandateIds, { offerStatus: "SENT" }),
    ...dateFilter("offerDate", range),
  }
  const offerAcceptedMatch = scopedFilter(organizationId, mandateIds, {
    offerStatus: "ACCEPTED",
    ...dateFilter("offerDate", range),
  })
  const offerAnyMatch = {
    ...scopedFilter(organizationId, mandateIds, { offerStatus: { $nin: ["DRAFT", "WITHDRAWN"] } }),
    ...dateFilter("createdAt", range),
  }

  const joinedMatch = {
    ...scopedFilter(organizationId, mandateIds, { status: "JOINED" }),
    ...dateFilter("joiningDate", range),
  }
  if (query.clientId) joinedMatch.clientId = query.clientId

  const dropoutMatch = {
    ...scopedFilter(organizationId, mandateIds, { status: { $in: DROPOUT_STATUSES } }),
    ...dateFilter("joiningDate", range),
  }
  const joiningOutcomeMatch = {
    ...scopedFilter(organizationId, mandateIds, { status: { $in: JOINING_OUTCOME_STATUSES } }),
    ...dateFilter("joiningDate", range),
  }
  if (query.clientId) {
    dropoutMatch.clientId = query.clientId
    joiningOutcomeMatch.clientId = query.clientId
  }

  const retentionMatch = {
    ...scopedFilter(organizationId, mandateIds, {
      retentionStatus: { $in: RETENTION_OUTCOME_STATUSES },
    }),
    ...dateFilter("guaranteeEndDate", range),
  }
  if (query.clientId) retentionMatch.clientId = query.clientId
  const retainedMatch = { ...retentionMatch, retentionStatus: "RETAINED" }

  const invoiceMatch: Record<string, unknown> = {
    organizationId,
    status: { $ne: "CANCELLED" },
    ...dateFilter("invoiceDate", range),
  }
  if (query.clientId) invoiceMatch.clientId = asObjectId(query.clientId)
  if (mandateIds) {
    const joiningIds = await JoiningModel.find({
      organizationId,
      mandateId: { $in: mandateIds },
    }).distinct("_id")
    invoiceMatch.joiningId = { $in: joiningIds }
  }

  const candidateCreatedMatch: Record<string, unknown> = {
    organizationId,
    ...dateFilter("createdAt", range),
  }
  const candidateAllMatch: Record<string, unknown> = { organizationId }

  if (mandateIds) {
    const linkedCandidateIds = await CandidateSubmissionModel.find({
      organizationId,
      mandateId: { $in: mandateIds },
    }).distinct("candidateId")
    candidateCreatedMatch._id = { $in: linkedCandidateIds }
    candidateAllMatch._id = { $in: linkedCandidateIds }
  }

  const [
    activeClients,
    openMandates,
    totalCandidates,
    candidatesSourced,
    candidatesScreened,
    candidatesSubmitted,
    interviewsScheduled,
    offersPending,
    offersAccepted,
    offersForConversion,
    interviewsForConversion,
    submissionsForConversion,
    candidatesJoined,
    joiningDropouts,
    joiningOutcomes,
    retained90,
    retentionOutcomes,
    invoiceTotals,
    timeToFirstSubmissionDays,
    timeToFillDays,
  ] = await Promise.all([
    ClientModel.countDocuments(clientMatch),
    RecruitmentMandateModel.countDocuments(mandateMatch),
    CandidateModel.countDocuments(candidateAllMatch),
    CandidateModel.countDocuments(candidateCreatedMatch),
    CandidateEvaluationModel.countDocuments(evaluationMatch),
    CandidateSubmissionModel.countDocuments(submissionMatch),
    InterviewModel.countDocuments(interviewMatch),
    OfferModel.countDocuments(offerPendingMatch),
    OfferModel.countDocuments(offerAcceptedMatch),
    OfferModel.countDocuments(offerAnyMatch),
    InterviewModel.countDocuments(interviewMatch),
    CandidateSubmissionModel.countDocuments(submissionMatch),
    JoiningModel.countDocuments(joinedMatch),
    JoiningModel.countDocuments(dropoutMatch),
    JoiningModel.countDocuments(joiningOutcomeMatch),
    GuaranteeFollowUpModel.countDocuments(retainedMatch as never),
    GuaranteeFollowUpModel.countDocuments(retentionMatch as never),
    InvoiceModel.aggregate<{ revenue?: number; outstanding?: number }>([
      { $match: invoiceMatch },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$paidAmount" },
          outstanding: { $sum: "$outstandingAmount" },
        },
      },
    ]),
    averageCycleDays(organizationId, mandateIds, "submission", range),
    averageCycleDays(organizationId, mandateIds, "joining", range),
  ])

  const revenue = round1(invoiceTotals[0]?.revenue ?? 0)
  const outstandingReceivables = round1(invoiceTotals[0]?.outstanding ?? 0)

  // Attribute paid invoice revenue to the recruiter who submitted the candidate
  // (joining → offer → submission.submittedBy). Fallback: first assigned mandate recruiter.
  // Use explicit collection names so unit tests can mock models without mongoose collections.
  const revenuePerRecruiterRows = await InvoiceModel.aggregate<{
    _id: mongoose.Types.ObjectId | null
    revenue: number
  }>([
    { $match: { ...invoiceMatch, paidAmount: { $gt: 0 } } },
    {
      $lookup: {
        from: "joinings",
        localField: "joiningId",
        foreignField: "_id",
        as: "joining",
      },
    },
    { $unwind: { path: "$joining", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "offers",
        localField: "joining.offerId",
        foreignField: "_id",
        as: "offer",
      },
    },
    { $unwind: { path: "$offer", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "candidatesubmissions",
        localField: "offer.submissionId",
        foreignField: "_id",
        as: "submission",
      },
    },
    { $unwind: { path: "$submission", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "recruitmentmandates",
        localField: "joining.mandateId",
        foreignField: "_id",
        as: "mandate",
      },
    },
    { $unwind: { path: "$mandate", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        recruiterId: {
          $ifNull: [
            "$submission.submittedBy",
            { $arrayElemAt: ["$mandate.assignedRecruiters", 0] },
          ],
        },
      },
    },
    { $match: { recruiterId: { $ne: null } } },
    { $group: { _id: "$recruiterId", revenue: { $sum: "$paidAmount" } } },
    { $sort: { revenue: -1 } },
  ])

  const recruiterIds = revenuePerRecruiterRows
    .map((row) => row._id)
    .filter((id): id is mongoose.Types.ObjectId => Boolean(id))
  const recruiters = recruiterIds.length
    ? await UserModel.find({ _id: { $in: recruiterIds }, organizationId }).select("_id name")
    : []
  const recruiterNameById = new Map(recruiters.map((user) => [String(user._id), user.name]))

  const revenuePerRecruiter = revenuePerRecruiterRows.map((row) => ({
    recruiterId: String(row._id),
    name: recruiterNameById.get(String(row._id)) ?? "Unknown recruiter",
    revenue: round1(row.revenue ?? 0),
  }))

  return {
    filters,
    metrics: {
      activeClients,
      openMandates,
      totalCandidates,
      candidatesSourced,
      candidatesScreened,
      candidatesSubmitted,
      interviewsScheduled,
      offersPending,
      candidatesJoined,
      timeToFirstSubmissionDays,
      timeToFillDays,
      submissionToInterviewPercent: ratioPercent(interviewsForConversion, submissionsForConversion),
      interviewToOfferPercent: ratioPercent(offersForConversion, interviewsForConversion),
      offerToJoinPercent: ratioPercent(candidatesJoined, offersAccepted),
      joiningDropoutPercent: ratioPercent(joiningDropouts, joiningOutcomes),
      retention90DayPercent: ratioPercent(retained90, retentionOutcomes),
      revenue,
      outstandingReceivables,
      revenuePerRecruiter,
    },
  }
}
