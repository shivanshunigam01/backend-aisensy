import {
  EVALUATION_RECOMMENDATION_LABELS,
  EVALUATION_SCORE_FIELDS,
  normalizeRecommendation,
  type EvaluationScoreField,
  type EvaluationScorecard,
  type EvaluationScoringVersion,
} from "../constants/evaluations.js"
import { MESSAGES } from "../constants/messages.js"
import { CandidateEvaluationModel } from "../models/candidate-evaluation.model.js"
import { CandidateSubmissionModel } from "../models/candidate-submission.model.js"
import { CandidateModel } from "../models/candidate.model.js"
import { RecruitmentMandateModel } from "../models/recruitment-mandate.model.js"
import { UserModel } from "../models/user.model.js"
import type { AuthContext } from "../types/auth.js"
import { recordActivity } from "../utils/activity.js"
import { recordAudit } from "../utils/audit.js"
import { AppError } from "../utils/app-error.js"
import { utcDateFromKey } from "../utils/dates.js"
import {
  approximateScorecardFromLegacy,
  calculateLegacyTotalScore,
  calculateScorecardTotal,
  emptyScorecard,
  normalizeScorecard,
} from "../utils/evaluation-score.js"
import { parseObjectId } from "../utils/object-id.js"
import { paginationMeta, paginationSkip } from "../utils/pagination.js"
import { applySearch, mongoSort, resolvedSearch } from "../utils/search.js"
import type {
  CreateEvaluationInput,
  EvaluationListQueryInput,
  UpdateEvaluationInput,
} from "../validators/evaluation.validators.js"

const EVALUATION_POPULATE = [
  { path: "candidateId", select: "firstName lastName name email candidateNumber" },
  { path: "mandateId", select: "mandateNumber position status" },
  { path: "recruiterId", select: "name email role" },
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

function stringsOf(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
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

function scoresOf(value: unknown) {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {}
  return {
    roleFit: Number(source.roleFit ?? 1),
    experienceFit: Number(source.experienceFit ?? 1),
    communication: Number(source.communication ?? 1),
    industryExperience: Number(source.industryExperience ?? 1),
    compensationFit: Number(source.compensationFit ?? 1),
    joiningProbability: Number(source.joiningProbability ?? 1),
  }
}

function scorecardOf(value: unknown, scores: ReturnType<typeof scoresOf>, version: string) {
  if (value && typeof value === "object") {
    const hasAny = Object.values(value as Record<string, unknown>).some(
      (entry) => Number(entry ?? 0) > 0
    )
    if (hasAny || version === "POINT_100") {
      return normalizeScorecard(value as Partial<EvaluationScorecard>)
    }
  }
  return approximateScorecardFromLegacy(scores)
}

export function toPublicEvaluation(doc: Record<string, unknown>) {
  const candidate = toCandidateRef(doc.candidateId)
  const mandate = toMandateRef(doc.mandateId)
  const recruiter = toUserRef(doc.recruiterId)
  const scores = scoresOf(doc.scores)
  const scoringVersion =
    (String(doc.scoringVersion ?? "LEGACY_6") as EvaluationScoringVersion) || "LEGACY_6"
  const scorecard = scorecardOf(doc.scorecard, scores, scoringVersion)
  const recommendation = normalizeRecommendation(String(doc.recommendation ?? "HOLD"))
  const totalScore =
    scoringVersion === "POINT_100"
      ? Number(doc.totalScore ?? calculateScorecardTotal(scorecard))
      : Number(doc.totalScore ?? calculateLegacyTotalScore(scores))

  return {
    id: String(doc._id ?? doc.id),
    organizationId: asId(doc.organizationId),
    candidateId: candidate?.id ?? asId(doc.candidateId),
    candidate,
    mandateId: mandate?.id ?? asId(doc.mandateId),
    mandate,
    recruiterId: recruiter?.id ?? asId(doc.recruiterId),
    recruiter,
    scoringVersion,
    scores,
    scorecard,
    totalScore,
    recommendation,
    recommendationLabel: EVALUATION_RECOMMENDATION_LABELS[recommendation] ?? recommendation,
    strengths: stringsOf(doc.strengths),
    concerns: stringsOf(doc.concerns),
    remarks: String(doc.remarks ?? ""),
    evaluatedAt: dateKeyOf(doc.evaluatedAt) || isoOf(doc.createdAt).slice(0, 10),
    createdAt: isoOf(doc.createdAt),
    updatedAt: isoOf(doc.updatedAt),
  }
}

async function requireEvaluation(organizationId: string, id: string) {
  parseObjectId(id)
  const evaluation = await CandidateEvaluationModel.findOne({
    _id: id,
    organizationId,
  }).populate([...EVALUATION_POPULATE])

  if (!evaluation) {
    throw AppError.notFound(MESSAGES.EVALUATION_NOT_FOUND)
  }

  return evaluation
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

async function assertRecruiter(organizationId: string, recruiterId: string) {
  parseObjectId(recruiterId, "Invalid recruiter")
  const user = await UserModel.findOne({
    _id: recruiterId,
    organizationId,
    isActive: true,
  }).select("_id")
  if (!user) {
    throw AppError.badRequest(MESSAGES.INVALID_RECRUITERS)
  }
  return user
}

function dateFromKey(value?: string | null) {
  if (!value) return null
  return utcDateFromKey(value)
}

function resolveScoringPayload(input: {
  scorecard?: CreateEvaluationInput["scorecard"]
  scores?: CreateEvaluationInput["scores"]
  scoringVersion?: EvaluationScoringVersion
}) {
  if (input.scorecard) {
    const scorecard = normalizeScorecard(input.scorecard)
    return {
      scoringVersion: "POINT_100" as const,
      scorecard,
      scores: input.scores ?? scoresOf(null),
      totalScore: calculateScorecardTotal(scorecard),
    }
  }

  const scores = input.scores ?? scoresOf(null)
  const scoringVersion: EvaluationScoringVersion =
    input.scoringVersion === "POINT_100" ? "POINT_100" : "LEGACY_6"
  return {
    scoringVersion,
    scorecard: emptyScorecard(),
    scores,
    totalScore:
      scoringVersion === "POINT_100"
        ? calculateScorecardTotal(emptyScorecard())
        : calculateLegacyTotalScore(scores),
  }
}

export async function listEvaluations(auth: AuthContext, query: EvaluationListQueryInput) {
  const filter: Record<string, unknown> = { organizationId: auth.organizationId }

  if (query.candidateId) {
    parseObjectId(query.candidateId, "Invalid candidate")
    filter.candidateId = query.candidateId
  }
  if (query.mandateId) {
    parseObjectId(query.mandateId, "Invalid mandate")
    filter.mandateId = query.mandateId
  }
  if (query.recruiterId) {
    parseObjectId(query.recruiterId, "Invalid recruiter")
    filter.recruiterId = query.recruiterId
  }
  if (query.recommendation) {
    filter.recommendation = query.recommendation
  }

  applySearch(filter, ["remarks"], resolvedSearch(query))

  const [items, total] = await Promise.all([
    CandidateEvaluationModel.find(filter)
      .populate([...EVALUATION_POPULATE])
      .sort(mongoSort(query, { evaluatedAt: -1, createdAt: -1 }))
      .skip(paginationSkip(query))
      .limit(query.limit)
      .lean(),
    CandidateEvaluationModel.countDocuments(filter),
  ])

  return {
    items: items.map((item) => toPublicEvaluation(item as Record<string, unknown>)),
    ...paginationMeta(total, query),
  }
}

export async function getEvaluation(auth: AuthContext, id: string) {
  const evaluation = await requireEvaluation(auth.organizationId, id)
  return toPublicEvaluation(evaluation.toObject() as Record<string, unknown>)
}

export async function createEvaluation(auth: AuthContext, input: CreateEvaluationInput) {
  const candidate = await assertCandidate(auth.organizationId, input.candidateId)
  const mandate = await assertMandate(auth.organizationId, input.mandateId)
  const recruiterId = input.recruiterId ?? auth.userId
  await assertRecruiter(auth.organizationId, recruiterId)

  const scoring = resolveScoringPayload(input)
  const recommendation = normalizeRecommendation(input.recommendation)

  const created = await CandidateEvaluationModel.create({
    organizationId: auth.organizationId,
    candidateId: candidate._id,
    mandateId: mandate._id,
    recruiterId,
    scoringVersion: scoring.scoringVersion,
    scores: scoring.scores,
    scorecard: scoring.scorecard,
    totalScore: scoring.totalScore,
    recommendation,
    strengths: input.strengths ?? [],
    concerns: input.concerns ?? [],
    remarks: input.remarks ?? "",
    evaluatedAt: dateFromKey(input.evaluatedAt) ?? new Date(),
  })

  await created.populate([...EVALUATION_POPULATE])
  const publicEvaluation = toPublicEvaluation(created.toObject() as Record<string, unknown>)
  const scoreLabel =
    scoring.scoringVersion === "POINT_100"
      ? `${created.totalScore}/100`
      : `${created.totalScore}/10`
  await recordActivity(auth.organizationId, {
    title: `Evaluation recorded for ${candidate.name || "candidate"}`,
    detail: `${mandate.mandateNumber} · ${scoreLabel}`,
    tone: "success",
  })
  await recordAudit(auth, {
    module: "EVALUATIONS",
    action: "CREATED",
    recordId: publicEvaluation.id,
    newData: publicEvaluation,
  })

  return publicEvaluation
}

export async function updateEvaluation(
  auth: AuthContext,
  id: string,
  input: UpdateEvaluationInput
) {
  const evaluation = await requireEvaluation(auth.organizationId, id)

  if (input.candidateId !== undefined) {
    const candidate = await assertCandidate(auth.organizationId, input.candidateId)
    evaluation.set("candidateId", candidate._id)
  }
  if (input.mandateId !== undefined) {
    const mandate = await assertMandate(auth.organizationId, input.mandateId)
    evaluation.set("mandateId", mandate._id)
  }
  if (input.recruiterId !== undefined) {
    await assertRecruiter(auth.organizationId, input.recruiterId)
    evaluation.set("recruiterId", input.recruiterId)
  }

  if (input.scorecard !== undefined) {
    const current = normalizeScorecard(evaluation.scorecard)
    const next = { ...current, ...input.scorecard }
    evaluation.set("scorecard", normalizeScorecard(next))
    evaluation.scoringVersion = "POINT_100"
    evaluation.totalScore = calculateScorecardTotal(next)
  } else if (input.scores !== undefined) {
    const current = scoresOf(evaluation.scores)
    const next = { ...current }
    for (const field of EVALUATION_SCORE_FIELDS) {
      const value = input.scores[field as EvaluationScoreField]
      if (value !== undefined) {
        next[field] = value
      }
    }
    evaluation.set("scores", next)
    if (evaluation.scoringVersion !== "POINT_100") {
      evaluation.scoringVersion = "LEGACY_6"
      evaluation.totalScore = calculateLegacyTotalScore(next)
    }
  }

  if (input.scoringVersion !== undefined && input.scorecard === undefined) {
    evaluation.scoringVersion = input.scoringVersion
  }
  if (input.recommendation !== undefined) {
    evaluation.recommendation = normalizeRecommendation(input.recommendation)
  }
  if (input.strengths !== undefined) evaluation.set("strengths", input.strengths)
  if (input.concerns !== undefined) evaluation.set("concerns", input.concerns)
  if (input.remarks !== undefined) evaluation.remarks = input.remarks ?? ""
  if (input.evaluatedAt !== undefined) {
    evaluation.evaluatedAt = dateFromKey(input.evaluatedAt) ?? evaluation.evaluatedAt
  }

  await evaluation.save()
  await evaluation.populate([...EVALUATION_POPULATE])
  return toPublicEvaluation(evaluation.toObject() as Record<string, unknown>)
}

export async function deleteEvaluation(auth: AuthContext, id: string) {
  parseObjectId(id)
  const hasSubmissions = await CandidateSubmissionModel.exists({
    organizationId: auth.organizationId,
    evaluationId: id,
  })
  if (hasSubmissions) {
    throw AppError.conflict(MESSAGES.EVALUATION_HAS_SUBMISSIONS)
  }

  const deleted = await CandidateEvaluationModel.findOneAndDelete({
    _id: id,
    organizationId: auth.organizationId,
  })
  if (!deleted) {
    throw AppError.notFound(MESSAGES.EVALUATION_NOT_FOUND)
  }
}
