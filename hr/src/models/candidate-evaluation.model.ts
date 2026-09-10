import mongoose, { Schema } from "mongoose"

import {
  EVALUATION_RECOMMENDATIONS,
  EVALUATION_SCORE_MAX,
  EVALUATION_SCORE_MIN,
  EVALUATION_SCORING_VERSIONS,
  EVALUATION_TOTAL_MAX,
} from "../constants/evaluations.js"
import {
  calculateLegacyTotalScore,
  calculateScorecardTotal,
  emptyScorecard,
} from "../utils/evaluation-score.js"

const legacyScoreField = {
  type: Number,
  min: EVALUATION_SCORE_MIN,
  max: EVALUATION_SCORE_MAX,
  default: EVALUATION_SCORE_MIN,
}

const scoresSchema = new Schema(
  {
    roleFit: legacyScoreField,
    experienceFit: legacyScoreField,
    communication: legacyScoreField,
    industryExperience: legacyScoreField,
    compensationFit: legacyScoreField,
    joiningProbability: legacyScoreField,
  },
  { _id: false }
)

const scorecardSchema = new Schema(
  {
    communication: { type: Number, min: 0, max: 10, default: 0 },
    roleKnowledge: { type: Number, min: 0, max: 20, default: 0 },
    relevantExperience: { type: Number, min: 0, max: 20, default: 0 },
    achievementEvidence: { type: Number, min: 0, max: 15, default: 0 },
    stability: { type: Number, min: 0, max: 10, default: 0 },
    locationFit: { type: Number, min: 0, max: 10, default: 0 },
    ctcFit: { type: Number, min: 0, max: 5, default: 0 },
    joiningProbability: { type: Number, min: 0, max: 10, default: 0 },
  },
  { _id: false }
)

const candidateEvaluationSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
      index: true,
    },
    mandateId: {
      type: Schema.Types.ObjectId,
      ref: "RecruitmentMandate",
      required: true,
      index: true,
    },
    recruiterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    scoringVersion: {
      type: String,
      enum: EVALUATION_SCORING_VERSIONS,
      default: "POINT_100",
      index: true,
    },
    /** Legacy 1–10 scores — retained for historical evaluations. */
    scores: {
      type: scoresSchema,
      default: () => ({
        roleFit: 1,
        experienceFit: 1,
        communication: 1,
        industryExperience: 1,
        compensationFit: 1,
        joiningProbability: 1,
      }),
    },
    /** Official 100-point scorecard. */
    scorecard: {
      type: scorecardSchema,
      default: () => emptyScorecard(),
    },
    totalScore: {
      type: Number,
      min: 0,
      max: EVALUATION_TOTAL_MAX,
      default: 0,
    },
    recommendation: {
      type: String,
      enum: EVALUATION_RECOMMENDATIONS,
      required: true,
      index: true,
    },
    strengths: { type: [String], default: [] },
    concerns: { type: [String], default: [] },
    remarks: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: "",
    },
    evaluatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
)

candidateEvaluationSchema.pre("save", function setTotalScore() {
  if (this.scoringVersion === "POINT_100") {
    this.totalScore = calculateScorecardTotal(this.scorecard)
  } else {
    this.totalScore = calculateLegacyTotalScore(this.scores)
  }
  if (!this.evaluatedAt) {
    this.evaluatedAt = new Date()
  }
})

candidateEvaluationSchema.index({ organizationId: 1, candidateId: 1, createdAt: -1 })
candidateEvaluationSchema.index({ organizationId: 1, mandateId: 1, createdAt: -1 })
candidateEvaluationSchema.index({ organizationId: 1, recruiterId: 1, createdAt: -1 })
candidateEvaluationSchema.index({ organizationId: 1, recommendation: 1, createdAt: -1 })

export const CandidateEvaluationModel = mongoose.model(
  "CandidateEvaluation",
  candidateEvaluationSchema
)
