import {
  EVALUATION_SCORECARD_FIELDS,
  EVALUATION_SCORECARD_MAX,
  EVALUATION_TOTAL_MAX,
  LEGACY_EVALUATION_SCORE_FIELDS,
  type EvaluationScorecard,
  type EvaluationScores,
  type EvaluationScoringVersion,
} from "../constants/evaluations.js"

/** Legacy average of 1–10 dimensions (historical evaluations). */
export function calculateLegacyTotalScore(scores: Partial<EvaluationScores> | null | undefined) {
  const values = LEGACY_EVALUATION_SCORE_FIELDS.map((field) => Number(scores?.[field] ?? 0)).filter(
    (value) => Number.isFinite(value)
  )

  if (!values.length) {
    return 0
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  return Math.round(average * 10) / 10
}

/** @deprecated Use calculateLegacyTotalScore or calculateScorecardTotal. */
export function calculateTotalScore(scores: Partial<EvaluationScores> | null | undefined) {
  return calculateLegacyTotalScore(scores)
}

export function emptyScorecard(): EvaluationScorecard {
  return {
    communication: 0,
    roleKnowledge: 0,
    relevantExperience: 0,
    achievementEvidence: 0,
    stability: 0,
    locationFit: 0,
    ctcFit: 0,
    joiningProbability: 0,
  }
}

export function clampScorecardField(field: keyof typeof EVALUATION_SCORECARD_MAX, value: number) {
  const max = EVALUATION_SCORECARD_MAX[field]
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(max, Math.max(0, Math.round(n * 10) / 10))
}

export function normalizeScorecard(
  input: Partial<EvaluationScorecard> | null | undefined
): EvaluationScorecard {
  const base = emptyScorecard()
  for (const field of EVALUATION_SCORECARD_FIELDS) {
    base[field] = clampScorecardField(field, Number(input?.[field] ?? 0))
  }
  return base
}

/** Sum of 100-point scorecard dimensions. */
export function calculateScorecardTotal(scorecard: Partial<EvaluationScorecard> | null | undefined) {
  const normalized = normalizeScorecard(scorecard)
  const total = EVALUATION_SCORECARD_FIELDS.reduce((sum, field) => sum + normalized[field], 0)
  return Math.min(EVALUATION_TOTAL_MAX, Math.round(total * 10) / 10)
}

/**
 * Map legacy 1–10 averages into an approximate 100-point scorecard for display only.
 * Does not mutate stored legacy scores.
 */
export function approximateScorecardFromLegacy(
  scores: Partial<EvaluationScores> | null | undefined
): EvaluationScorecard {
  const s = scores ?? {}
  const scale = (value: number, field: keyof typeof EVALUATION_SCORECARD_MAX) =>
    clampScorecardField(field, (Number(value) || 0) * (EVALUATION_SCORECARD_MAX[field] / 10))

  return {
    communication: scale(Number(s.communication ?? 0), "communication"),
    roleKnowledge: scale(Number(s.roleFit ?? 0), "roleKnowledge"),
    relevantExperience: scale(Number(s.experienceFit ?? 0), "relevantExperience"),
    achievementEvidence: scale(Number(s.industryExperience ?? 0), "achievementEvidence"),
    stability: scale(Number(s.experienceFit ?? 0), "stability"),
    locationFit: scale(Number(s.roleFit ?? 0), "locationFit"),
    ctcFit: scale(Number(s.compensationFit ?? 0), "ctcFit"),
    joiningProbability: scale(Number(s.joiningProbability ?? 0), "joiningProbability"),
  }
}

export function resolveEvaluationTotal(input: {
  scoringVersion?: EvaluationScoringVersion | string | null
  scorecard?: Partial<EvaluationScorecard> | null
  scores?: Partial<EvaluationScores> | null
  totalScore?: number | null
}) {
  if (input.scoringVersion === "POINT_100" || input.scorecard) {
    return calculateScorecardTotal(input.scorecard)
  }
  if (typeof input.totalScore === "number" && Number.isFinite(input.totalScore)) {
    return input.totalScore
  }
  return calculateLegacyTotalScore(input.scores)
}
