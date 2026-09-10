import { z } from "zod"

import {
  EVALUATION_RECOMMENDATIONS,
  EVALUATION_SCORE_MAX,
  EVALUATION_SCORE_MIN,
  EVALUATION_SCORECARD_MAX,
  EVALUATION_SCORING_VERSIONS,
} from "../constants/evaluations.js"
import { listControlFields } from "./list-query.js"
import { objectIdSchema } from "./organization.validators.js"

const emptyToUndefined = (value: string | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const legacyScore = z.coerce.number().min(EVALUATION_SCORE_MIN).max(EVALUATION_SCORE_MAX)

const scoresSchema = z.object({
  roleFit: legacyScore,
  experienceFit: legacyScore,
  communication: legacyScore,
  industryExperience: legacyScore,
  compensationFit: legacyScore,
  joiningProbability: legacyScore,
})

const scorecardSchema = z.object({
  communication: z.coerce.number().min(0).max(EVALUATION_SCORECARD_MAX.communication),
  roleKnowledge: z.coerce.number().min(0).max(EVALUATION_SCORECARD_MAX.roleKnowledge),
  relevantExperience: z.coerce.number().min(0).max(EVALUATION_SCORECARD_MAX.relevantExperience),
  achievementEvidence: z.coerce.number().min(0).max(EVALUATION_SCORECARD_MAX.achievementEvidence),
  stability: z.coerce.number().min(0).max(EVALUATION_SCORECARD_MAX.stability),
  locationFit: z.coerce.number().min(0).max(EVALUATION_SCORECARD_MAX.locationFit),
  ctcFit: z.coerce.number().min(0).max(EVALUATION_SCORECARD_MAX.ctcFit),
  joiningProbability: z.coerce.number().min(0).max(EVALUATION_SCORECARD_MAX.joiningProbability),
})

const stringList = z.array(z.string().trim().min(1).max(240)).max(20).optional()

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")

const optionalDateOnly = z
  .union([dateOnlySchema, z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined))

export const createEvaluationSchema = z
  .object({
    candidateId: objectIdSchema,
    mandateId: objectIdSchema,
    recruiterId: objectIdSchema.optional(),
    scoringVersion: z.enum(EVALUATION_SCORING_VERSIONS).optional(),
    scores: scoresSchema.optional(),
    scorecard: scorecardSchema.optional(),
    recommendation: z.enum(EVALUATION_RECOMMENDATIONS),
    strengths: stringList,
    concerns: stringList,
    remarks: z.string().trim().max(4000).optional().transform(emptyToUndefined),
    evaluatedAt: optionalDateOnly,
  })
  .superRefine((value, ctx) => {
    const version = value.scoringVersion ?? "POINT_100"
    if (version === "POINT_100" && !value.scorecard) {
      ctx.addIssue({
        code: "custom",
        path: ["scorecard"],
        message: "Scorecard is required for 100-point evaluations",
      })
    }
    if (version === "LEGACY_6" && !value.scores) {
      ctx.addIssue({
        code: "custom",
        path: ["scores"],
        message: "Legacy scores are required for LEGACY_6 evaluations",
      })
    }
  })

export const updateEvaluationSchema = z.object({
  candidateId: objectIdSchema.optional(),
  mandateId: objectIdSchema.optional(),
  recruiterId: objectIdSchema.optional(),
  scoringVersion: z.enum(EVALUATION_SCORING_VERSIONS).optional(),
  scores: scoresSchema.partial().optional(),
  scorecard: scorecardSchema.partial().optional(),
  recommendation: z.enum(EVALUATION_RECOMMENDATIONS).optional(),
  strengths: stringList,
  concerns: stringList,
  remarks: z.string().trim().max(4000).optional().transform(emptyToUndefined),
  evaluatedAt: optionalDateOnly,
})

export const evaluationListQuerySchema = z.object({
  candidateId: objectIdSchema.optional(),
  mandateId: objectIdSchema.optional(),
  recruiterId: objectIdSchema.optional(),
  recommendation: z.enum(EVALUATION_RECOMMENDATIONS).optional(),
  ...listControlFields(["evaluatedAt", "createdAt", "recommendation"] as const),
})

export type CreateEvaluationInput = z.infer<typeof createEvaluationSchema>
export type UpdateEvaluationInput = z.infer<typeof updateEvaluationSchema>
export type EvaluationListQueryInput = z.infer<typeof evaluationListQuerySchema>
