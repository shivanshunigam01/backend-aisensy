import mongoose from "mongoose"

import {
  PIPELINE_ALLOWED_TRANSITIONS,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGES,
  type PipelineStage,
} from "../constants/pipeline.js"
import { isConfirmedJoiningStatus } from "../constants/joinings.js"
import { isOpenReplacementStatus } from "../constants/replacements.js"
import { isIntroducedSubmissionStatus } from "../constants/submissions.js"
import { CandidateConsentModel } from "../models/candidate-consent.model.js"
import { CandidateEvaluationModel } from "../models/candidate-evaluation.model.js"
import { CandidateSubmissionModel } from "../models/candidate-submission.model.js"
import { CandidateModel } from "../models/candidate.model.js"
import { GuaranteeFollowUpModel } from "../models/guarantee-follow-up.model.js"
import { InterviewModel } from "../models/interview.model.js"
import { JobApplicationModel } from "../models/job-application.model.js"
import { JoiningModel } from "../models/joining.model.js"
import { OfferModel } from "../models/offer.model.js"
import { RecruitmentMandateModel } from "../models/recruitment-mandate.model.js"
import { ReplacementCaseModel } from "../models/replacement-case.model.js"
import type { AuthContext } from "../types/auth.js"
import { AppError } from "../utils/app-error.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { escapeRegex, resolvedSearch } from "../utils/search.js"
import { resolveEvaluationTotal } from "../utils/evaluation-score.js"
import type {
  PipelineListQueryInput,
  PipelineTransitionInput,
} from "../validators/pipeline.validators.js"

type PairKey = string

type CandidateRef = {
  id: string
  name: string
  email: string
  candidateNumber: string
  status: string
}

type MandateRef = {
  id: string
  mandateNumber: string
  position: string
  status: string
  clientId: string
}

type QuickAction = {
  label: string
  href: string
}

type PipelineContext = {
  consent?: Record<string, unknown> | null
  evaluation?: Record<string, unknown> | null
  submission?: Record<string, unknown> | null
  interview?: Record<string, unknown> | null
  offer?: Record<string, unknown> | null
  joining?: Record<string, unknown> | null
  guarantee?: Record<string, unknown> | null
  replacement?: Record<string, unknown> | null
  linkedViaApplication?: boolean
}

function pairKey(candidateId: string, mandateId: string): PairKey {
  return `${candidateId}:${mandateId}`
}

function asId(value: unknown) {
  if (!value) return ""
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id: unknown })._id)
  }
  return String(value)
}

function candidateName(doc: Record<string, unknown>) {
  const name = String(doc.name ?? "").trim()
  if (name) return name
  return `${String(doc.firstName ?? "")} ${String(doc.lastName ?? "")}`.trim()
}

function toCandidateRef(doc: Record<string, unknown> | null | undefined): CandidateRef | null {
  if (!doc) return null
  return {
    id: asId(doc._id ?? doc.id),
    name: candidateName(doc),
    email: String(doc.email ?? ""),
    candidateNumber: String(doc.candidateNumber ?? ""),
    status: String(doc.status ?? ""),
  }
}

function toMandateRef(doc: Record<string, unknown> | null | undefined): MandateRef | null {
  if (!doc) return null
  return {
    id: asId(doc._id ?? doc.id),
    mandateNumber: String(doc.mandateNumber ?? ""),
    position: String(doc.position ?? ""),
    status: String(doc.status ?? ""),
    clientId: asId(doc.clientId),
  }
}

function consentIsActive(consent: Record<string, unknown> | null | undefined) {
  if (!consent) return false
  if (consent.withdrawnAt) return false
  if (!consent.consentGiven) return false
  const expiry = consent.expiryDate
  if (expiry) {
    const key =
      expiry instanceof Date
        ? expiry.toISOString().slice(0, 10)
        : String(expiry).slice(0, 10)
    if (key && key < new Date().toISOString().slice(0, 10)) return false
  }
  return true
}

function duplicateNeedsReview(status: string) {
  return (
    status === "POSSIBLE_DUPLICATE" ||
    status === "CONFIRMED_DUPLICATE" ||
    status === "DISPUTED"
  )
}

function offerIsActive(status: string) {
  return status === "DRAFT" || status === "SENT" || status === "ACCEPTED"
}

export function derivePipelineStage(ctx: PipelineContext): PipelineStage {
  const replacementStatus = String(ctx.replacement?.status ?? "")
  if (replacementStatus && isOpenReplacementStatus(replacementStatus)) {
    return "REPLACEMENT"
  }

  const joiningStatus = String(ctx.joining?.status ?? "")
  const joiningConfirmed = joiningStatus && isConfirmedJoiningStatus(joiningStatus)
  if (ctx.guarantee && joiningConfirmed) {
    return "GUARANTEE"
  }

  if (joiningStatus === "JOINED" || joiningStatus === "CONFIRMED") {
    return "JOINED"
  }

  if (joiningStatus === "NO_SHOW" || joiningStatus === "WITHDRAWN") {
    return "NOT_JOINED"
  }

  const offerStatus = String(ctx.offer?.offerStatus ?? "")
  if (offerStatus === "ACCEPTED") {
    return "OFFER_ACCEPTED"
  }
  if (offerStatus && offerIsActive(offerStatus)) {
    return "OFFER"
  }

  if (ctx.interview) {
    return "INTERVIEW"
  }

  const duplicateStatus = String(ctx.submission?.duplicateStatus ?? "")
  if (ctx.submission && duplicateNeedsReview(duplicateStatus)) {
    return "DUPLICATE_REVIEW"
  }

  const submissionStatus = String(ctx.submission?.status ?? "")
  if (ctx.submission && isIntroducedSubmissionStatus(submissionStatus)) {
    return "SUBMITTED"
  }

  if (ctx.evaluation) {
    return "EVALUATED"
  }

  if (consentIsActive(ctx.consent)) {
    return "CONSENT_RECEIVED"
  }

  if (ctx.consent || ctx.linkedViaApplication || ctx.submission || ctx.evaluation) {
    return "CONSENT_PENDING"
  }

  return "SOURCED"
}

function quickActionsFor(
  stage: PipelineStage,
  candidateId: string,
  mandateId: string,
  ctx: PipelineContext
): QuickAction[] {
  const q = `candidateId=${candidateId}&mandateId=${mandateId}`
  const actions: QuickAction[] = []

  switch (stage) {
    case "SOURCED":
    case "CONSENT_PENDING":
      actions.push({ label: "Record consent", href: `/recruitment/consents/new?${q}` })
      break
    case "CONSENT_RECEIVED":
      actions.push({ label: "Evaluate", href: `/recruitment/evaluations/new?${q}` })
      break
    case "EVALUATED":
      actions.push({
        label: "Submit to client",
        href: `/recruitment/submissions/new?${q}${
          ctx.evaluation ? `&evaluationId=${asId(ctx.evaluation._id)}` : ""
        }`,
      })
      break
    case "SUBMITTED":
      actions.push({
        label: "Schedule interview",
        href: `/recruitment/interviews/new?${q}${
          ctx.submission ? `&submissionId=${asId(ctx.submission._id)}` : ""
        }`,
      })
      if (ctx.submission) {
        actions.push({
          label: "Review submission",
          href: `/recruitment/submissions/${asId(ctx.submission._id)}/edit`,
        })
      }
      break
    case "DUPLICATE_REVIEW":
      if (ctx.submission) {
        actions.push({
          label: "Resolve duplicate",
          href: `/recruitment/submissions/${asId(ctx.submission._id)}/edit`,
        })
      }
      break
    case "INTERVIEW":
      actions.push({
        label: "Create offer",
        href: `/recruitment/offers/new?${q}${
          ctx.submission ? `&submissionId=${asId(ctx.submission._id)}` : ""
        }`,
      })
      break
    case "OFFER":
      if (ctx.offer) {
        actions.push({
          label: "Update offer",
          href: `/recruitment/offers/${asId(ctx.offer._id)}/edit`,
        })
      }
      break
    case "OFFER_ACCEPTED":
      actions.push({
        label: "Record joining",
        href: `/recruitment/joinings/new?${q}${
          ctx.offer ? `&offerId=${asId(ctx.offer._id)}` : ""
        }`,
      })
      actions.push({ label: "Pre-joining follow-up", href: `/recruitment/pre-joining/new?${q}` })
      break
    case "JOINED":
      actions.push({
        label: "Guarantee tracking",
        href: `/recruitment/guarantees/new?${
          ctx.joining ? `joiningId=${asId(ctx.joining._id)}` : q
        }`,
      })
      break
    case "GUARANTEE":
      if (ctx.guarantee) {
        actions.push({
          label: "Update guarantee",
          href: `/recruitment/guarantees/${asId(ctx.guarantee._id)}/edit`,
        })
      }
      actions.push({
        label: "Open replacement",
        href: `/recruitment/replacements/new?${
          ctx.joining ? `joiningId=${asId(ctx.joining._id)}` : q
        }`,
      })
      break
    case "REPLACEMENT":
      if (ctx.replacement) {
        actions.push({
          label: "Update replacement",
          href: `/recruitment/replacements/${asId(ctx.replacement._id)}/edit`,
        })
      }
      break
    case "NOT_JOINED":
    case "CLOSED":
      actions.push({ label: "View candidate", href: `/recruitment/candidates/${candidateId}/edit` })
      break
    default:
      break
  }

  actions.push({ label: "View candidate", href: `/recruitment/candidates/${candidateId}/edit` })
  return actions
}

function emptyStageCounts(): Record<PipelineStage, number> {
  return Object.fromEntries(PIPELINE_STAGES.map((stage) => [stage, 0])) as Record<
    PipelineStage,
    number
  >
}

async function loadPairContext(
  organizationId: string,
  candidateId: string,
  mandateId: string,
  linkedViaApplication: boolean
): Promise<PipelineContext> {
  const [
    consent,
    evaluation,
    submission,
    interview,
    offer,
    joining,
    guarantee,
    replacement,
  ] = await Promise.all([
    CandidateConsentModel.findOne({ organizationId, candidateId, mandateId })
      .sort({ createdAt: -1 })
      .lean(),
    CandidateEvaluationModel.findOne({ organizationId, candidateId, mandateId })
      .sort({ evaluatedAt: -1, createdAt: -1 })
      .lean(),
    CandidateSubmissionModel.findOne({ organizationId, candidateId, mandateId })
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean(),
    InterviewModel.findOne({
      organizationId,
      candidateId,
      mandateId,
      status: { $ne: "CANCELLED" },
    })
      .sort({ scheduledAt: -1 })
      .lean(),
    OfferModel.findOne({
      organizationId,
      candidateId,
      mandateId,
      offerStatus: { $nin: ["WITHDRAWN", "EXPIRED"] },
    })
      .sort({ createdAt: -1 })
      .lean(),
    JoiningModel.findOne({ organizationId, candidateId, mandateId })
      .sort({ joiningDate: -1, createdAt: -1 })
      .lean(),
    GuaranteeFollowUpModel.findOne({ organizationId, candidateId, mandateId })
      .sort({ createdAt: -1 })
      .lean(),
    ReplacementCaseModel.findOne({
      organizationId,
      candidateId,
      mandateId,
      status: { $in: ["ACTIVE", "REPLACEMENT_REQUESTED", "REPLACEMENT_IN_PROGRESS"] },
    })
      .sort({ createdAt: -1 })
      .lean(),
  ])

  return {
    consent: consent as Record<string, unknown> | null,
    evaluation: evaluation as Record<string, unknown> | null,
    submission: submission as Record<string, unknown> | null,
    interview: interview as Record<string, unknown> | null,
    offer: offer as Record<string, unknown> | null,
    joining: joining as Record<string, unknown> | null,
    guarantee: guarantee as Record<string, unknown> | null,
    replacement: replacement as Record<string, unknown> | null,
    linkedViaApplication,
  }
}

/**
 * Mandate-centric pipeline: stages are derived from linked recruitment entities
 * (consent → evaluation → submission → interview → offer → joining → guarantee/replacement).
 */
export async function getMandatePipeline(auth: AuthContext, query: PipelineListQueryInput) {
  const organizationId = auth.organizationId
  const orgOid = new mongoose.Types.ObjectId(organizationId)

  const mandateFilter: Record<string, unknown> = { organizationId }
  if (query.mandateId) {
    parseObjectId(query.mandateId, "Invalid mandate")
    mandateFilter._id = query.mandateId
  }
  if (query.recruiterId) {
    parseObjectId(query.recruiterId, "Invalid recruiter")
    mandateFilter.assignedRecruiters = query.recruiterId
  }

  const mandates = await RecruitmentMandateModel.find(mandateFilter)
    .select("_id mandateNumber position status clientId assignedRecruiters")
    .lean()

  const mandateIds = mandates.map((m) => m._id)
  const mandateById = new Map(mandates.map((m) => [String(m._id), m as Record<string, unknown>]))

  const mandatesSummary = mandates.map((m) => ({
    id: String(m._id),
    mandateNumber: String(m.mandateNumber ?? ""),
    position: String(m.position ?? ""),
    status: String(m.status ?? ""),
    clientId: asId(m.clientId),
  }))

  if (mandateIds.length === 0) {
    return {
      mandates: mandatesSummary,
      stageCounts: emptyStageCounts(),
      items: [],
      ...paginationMeta(0, query),
    }
  }

  const [consents, evaluations, submissions, applications] = await Promise.all([
    CandidateConsentModel.find({ organizationId, mandateId: { $in: mandateIds } })
      .select("candidateId mandateId")
      .lean(),
    CandidateEvaluationModel.find({ organizationId, mandateId: { $in: mandateIds } })
      .select("candidateId mandateId")
      .lean(),
    CandidateSubmissionModel.find({ organizationId, mandateId: { $in: mandateIds } })
      .select("candidateId mandateId")
      .lean(),
    JobApplicationModel.find({ organizationId, mandateId: { $in: mandateIds } })
      .select("candidateId mandateId")
      .lean(),
  ])

  const pairMap = new Map<PairKey, { candidateId: string; mandateId: string; viaApp: boolean }>()
  const mark = (candidateId: unknown, mandateId: unknown, viaApp = false) => {
    const c = asId(candidateId)
    const m = asId(mandateId)
    if (!c || !m) return
    const key = pairKey(c, m)
    const existing = pairMap.get(key)
    if (existing) {
      existing.viaApp = existing.viaApp || viaApp
      return
    }
    pairMap.set(key, { candidateId: c, mandateId: m, viaApp })
  }

  for (const row of consents) mark(row.candidateId, row.mandateId)
  for (const row of evaluations) mark(row.candidateId, row.mandateId)
  for (const row of submissions) mark(row.candidateId, row.mandateId)
  for (const row of applications) mark(row.candidateId, row.mandateId, true)

  const pairs = [...pairMap.values()]
  const candidateIds = [...new Set(pairs.map((p) => p.candidateId))]

  const candidates = await CandidateModel.find({
    _id: { $in: candidateIds.map((id) => new mongoose.Types.ObjectId(id)) },
    organizationId: orgOid,
  })
    .select("_id name firstName lastName email candidateNumber status")
    .lean()
  const candidateById = new Map(
    candidates.map((c) => [String(c._id), c as Record<string, unknown>])
  )

  const search = resolvedSearch(query)
  const searchRegex = search ? new RegExp(escapeRegex(search), "i") : null

  const built: Array<{
    candidateId: string
    candidate: CandidateRef
    mandateId: string
    mandate: MandateRef
    stage: PipelineStage
    stageLabel: string
    submissionId: string
    evaluationScore: number | null
    ownershipStatus: string
    quickActions: QuickAction[]
    ctx: PipelineContext
  }> = []

  // Batch-load related docs for all pairs (scoped by mandate set)
  const [
    allConsents,
    allEvaluations,
    allSubmissions,
    allInterviews,
    allOffers,
    allJoinings,
    allGuarantees,
    allReplacements,
  ] = await Promise.all([
    CandidateConsentModel.find({ organizationId, mandateId: { $in: mandateIds } })
      .sort({ createdAt: -1 })
      .lean(),
    CandidateEvaluationModel.find({ organizationId, mandateId: { $in: mandateIds } })
      .sort({ evaluatedAt: -1, createdAt: -1 })
      .lean(),
    CandidateSubmissionModel.find({ organizationId, mandateId: { $in: mandateIds } })
      .sort({ submittedAt: -1, createdAt: -1 })
      .lean(),
    InterviewModel.find({
      organizationId,
      mandateId: { $in: mandateIds },
      status: { $ne: "CANCELLED" },
    })
      .sort({ scheduledAt: -1 })
      .lean(),
    OfferModel.find({
      organizationId,
      mandateId: { $in: mandateIds },
      offerStatus: { $nin: ["WITHDRAWN", "EXPIRED"] },
    })
      .sort({ createdAt: -1 })
      .lean(),
    JoiningModel.find({ organizationId, mandateId: { $in: mandateIds } })
      .sort({ joiningDate: -1, createdAt: -1 })
      .lean(),
    GuaranteeFollowUpModel.find({ organizationId, mandateId: { $in: mandateIds } })
      .sort({ createdAt: -1 })
      .lean(),
    ReplacementCaseModel.find({
      organizationId,
      mandateId: { $in: mandateIds },
      status: { $in: ["ACTIVE", "REPLACEMENT_REQUESTED", "REPLACEMENT_IN_PROGRESS"] },
    })
      .sort({ createdAt: -1 })
      .lean(),
  ])

  function latestByPair(rows: Array<Record<string, unknown>>) {
    const map = new Map<PairKey, Record<string, unknown>>()
    for (const row of rows) {
      const key = pairKey(asId(row.candidateId), asId(row.mandateId))
      if (!map.has(key)) map.set(key, row)
    }
    return map
  }

  const consentMap = latestByPair(allConsents as Array<Record<string, unknown>>)
  const evaluationMap = latestByPair(allEvaluations as Array<Record<string, unknown>>)
  const submissionMap = latestByPair(allSubmissions as Array<Record<string, unknown>>)
  const interviewMap = latestByPair(allInterviews as Array<Record<string, unknown>>)
  const offerMap = latestByPair(allOffers as Array<Record<string, unknown>>)
  const joiningMap = latestByPair(allJoinings as Array<Record<string, unknown>>)
  const guaranteeMap = latestByPair(allGuarantees as Array<Record<string, unknown>>)
  const replacementMap = latestByPair(allReplacements as Array<Record<string, unknown>>)

  const stageCounts = emptyStageCounts()

  for (const pair of pairs) {
    const candidate = toCandidateRef(candidateById.get(pair.candidateId))
    const mandate = toMandateRef(mandateById.get(pair.mandateId))
    if (!candidate || !mandate) continue

    if (searchRegex) {
      const haystack = [
        candidate.name,
        candidate.email,
        candidate.candidateNumber,
        mandate.mandateNumber,
        mandate.position,
      ].join(" ")
      if (!searchRegex.test(haystack)) continue
    }

    const key = pairKey(pair.candidateId, pair.mandateId)
    const ctx: PipelineContext = {
      consent: consentMap.get(key) ?? null,
      evaluation: evaluationMap.get(key) ?? null,
      submission: submissionMap.get(key) ?? null,
      interview: interviewMap.get(key) ?? null,
      offer: offerMap.get(key) ?? null,
      joining: joiningMap.get(key) ?? null,
      guarantee: guaranteeMap.get(key) ?? null,
      replacement: replacementMap.get(key) ?? null,
      linkedViaApplication: pair.viaApp,
    }

    const stage = derivePipelineStage(ctx)
    stageCounts[stage] += 1

    if (query.stage && query.stage !== stage) continue

    const evaluation = ctx.evaluation
    const evaluationScore = evaluation
      ? resolveEvaluationTotal({
          scoringVersion: String(evaluation.scoringVersion ?? ""),
          scorecard: evaluation.scorecard as never,
          scores: evaluation.scores as never,
          totalScore: Number(evaluation.totalScore ?? NaN),
        })
      : ctx.submission?.evaluationScore != null
        ? Number(ctx.submission.evaluationScore)
        : null

    built.push({
      candidateId: pair.candidateId,
      candidate,
      mandateId: pair.mandateId,
      mandate,
      stage,
      stageLabel: PIPELINE_STAGE_LABELS[stage],
      submissionId: ctx.submission ? asId(ctx.submission._id) : "",
      evaluationScore,
      ownershipStatus: String(ctx.submission?.ownershipStatus ?? ""),
      quickActions: quickActionsFor(stage, pair.candidateId, pair.mandateId, ctx),
      ctx,
    })
  }

  // Stable order: mandate number, then candidate name
  built.sort((a, b) => {
    const m = a.mandate.mandateNumber.localeCompare(b.mandate.mandateNumber)
    if (m !== 0) return m
    return a.candidate.name.localeCompare(b.candidate.name)
  })

  const total = built.length
  const pageItems = built.slice(paginationSkip(query), paginationSkip(query) + query.limit)

  return {
    mandates: mandatesSummary,
    stageCounts,
    items: pageItems.map(({ ctx: _ctx, ...item }) => item),
    ...paginationMeta(total, query),
  }
}

export async function transitionPipelineStage(
  auth: AuthContext,
  input: PipelineTransitionInput
) {
  parseObjectId(input.candidateId, "Invalid candidate")
  parseObjectId(input.mandateId, "Invalid mandate")

  const candidate = await CandidateModel.findOne({
    _id: input.candidateId,
    organizationId: auth.organizationId,
  }).select("_id name")
  if (!candidate) {
    throw AppError.badRequest("Candidate not found in this organization")
  }

  const mandate = await RecruitmentMandateModel.findOne({
    _id: input.mandateId,
    organizationId: auth.organizationId,
  }).select("_id mandateNumber position status")
  if (!mandate) {
    throw AppError.badRequest("Mandate not found in this organization")
  }

  const viaApp = Boolean(
    await JobApplicationModel.exists({
      organizationId: auth.organizationId,
      candidateId: input.candidateId,
      mandateId: input.mandateId,
    })
  )

  const ctx = await loadPairContext(
    auth.organizationId,
    input.candidateId,
    input.mandateId,
    viaApp
  )
  const currentStage = derivePipelineStage(ctx)
  const allowed = PIPELINE_ALLOWED_TRANSITIONS[currentStage]

  if (!allowed.includes(input.targetStage)) {
    throw AppError.badRequest(
      `Cannot move from ${PIPELINE_STAGE_LABELS[currentStage]} to ${PIPELINE_STAGE_LABELS[input.targetStage]}. Allowed: ${
        allowed.length
          ? allowed.map((s) => PIPELINE_STAGE_LABELS[s]).join(", ")
          : "none"
      }.`
    )
  }

  const q = `candidateId=${input.candidateId}&mandateId=${input.mandateId}`
  const target = input.targetStage

  // Safe minimal updates where entity already exists or no inventable data is required.
  if (target === "DUPLICATE_REVIEW") {
    if (!ctx.submission) {
      throw AppError.badRequest(
        `Submit the candidate first via /recruitment/submissions/new?${q}`
      )
    }
    await CandidateSubmissionModel.updateOne(
      { _id: ctx.submission._id },
      { $set: { duplicateStatus: "POSSIBLE_DUPLICATE" } }
    )
    return {
      message: "Marked for duplicate review",
      currentStage: "DUPLICATE_REVIEW" as PipelineStage,
      stageLabel: PIPELINE_STAGE_LABELS.DUPLICATE_REVIEW,
    }
  }

  if (target === "SUBMITTED" && currentStage === "DUPLICATE_REVIEW") {
    if (!ctx.submission) {
      throw AppError.badRequest("Submission not found for this candidate and mandate")
    }
    await CandidateSubmissionModel.updateOne(
      { _id: ctx.submission._id },
      { $set: { duplicateStatus: "NOT_DUPLICATE" } }
    )
    return {
      message: "Duplicate cleared; candidate remains submitted",
      currentStage: "SUBMITTED" as PipelineStage,
      stageLabel: PIPELINE_STAGE_LABELS.SUBMITTED,
    }
  }

  if (target === "OFFER_ACCEPTED") {
    if (!ctx.offer) {
      throw AppError.badRequest(
        `Create and send an offer first via /recruitment/offers/new?${q}`
      )
    }
    await OfferModel.updateOne(
      { _id: ctx.offer._id },
      { $set: { offerStatus: "ACCEPTED" } }
    )
    return {
      message: "Offer marked as accepted",
      currentStage: "OFFER_ACCEPTED" as PipelineStage,
      stageLabel: PIPELINE_STAGE_LABELS.OFFER_ACCEPTED,
    }
  }

  if (target === "NOT_JOINED") {
    if (ctx.joining) {
      await JoiningModel.updateOne(
        { _id: ctx.joining._id },
        { $set: { status: "WITHDRAWN" } }
      )
      return {
        message: "Joining marked as withdrawn (not joined)",
        currentStage: "NOT_JOINED" as PipelineStage,
        stageLabel: PIPELINE_STAGE_LABELS.NOT_JOINED,
      }
    }
    if (ctx.offer) {
      await OfferModel.updateOne(
        { _id: ctx.offer._id },
        { $set: { offerStatus: "REJECTED", joiningStatus: "WITHDRAWN" } }
      )
      return {
        message: "Offer marked rejected / not joined",
        currentStage: "NOT_JOINED" as PipelineStage,
        stageLabel: PIPELINE_STAGE_LABELS.NOT_JOINED,
      }
    }
    throw AppError.badRequest(
      `Record an offer or joining before marking not joined. Use /recruitment/offers/new?${q}`
    )
  }

  // Transitions that require dedicated forms / inventable data
  const guidance: Partial<Record<PipelineStage, string>> = {
    CONSENT_PENDING: `Open the consent form: /recruitment/consents/new?${q}`,
    CONSENT_RECEIVED: `Record consent as given: /recruitment/consents/new?${q}`,
    EVALUATED: `Complete the evaluation scorecard: /recruitment/evaluations/new?${q}`,
    SUBMITTED: `Submit the candidate to the client: /recruitment/submissions/new?${q}`,
    INTERVIEW: `Schedule an interview (cannot invent rounds): /recruitment/interviews/new?${q}`,
    OFFER: `Create an offer from the interview outcome: /recruitment/offers/new?${q}`,
    JOINED: `Record joining confirmation: /recruitment/joinings/new?${q}`,
    GUARANTEE: ctx.joining
      ? `Start guarantee tracking: /recruitment/guarantees/new?joiningId=${asId(ctx.joining._id)}`
      : `Record joining first, then start guarantee tracking.`,
    REPLACEMENT: ctx.joining
      ? `Open a replacement case: /recruitment/replacements/new?joiningId=${asId(ctx.joining._id)}`
      : `Record a joining before opening replacement.`,
    CLOSED:
      "Close from the mandate or related records (cancel mandate / withdraw submission) on their pages. Pipeline stages are derived and cannot invent a closed state.",
    SOURCED: "Candidate is already at sourced for this mandate.",
  }

  throw AppError.badRequest(
    guidance[target] ??
      `Complete this step on the dedicated form. Current stage: ${PIPELINE_STAGE_LABELS[currentStage]}.`
  )
}
