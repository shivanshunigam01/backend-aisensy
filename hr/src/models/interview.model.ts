import mongoose, { Schema } from "mongoose"

import {
  INTERVIEW_DECISIONS,
  INTERVIEW_DURATION_DEFAULT,
  INTERVIEW_DURATION_MAX,
  INTERVIEW_DURATION_MIN,
  INTERVIEW_SCORE_MAX,
  INTERVIEW_SCORE_MIN,
  INTERVIEW_STATUSES,
  INTERVIEW_TYPES,
} from "../constants/interviews.js"

const scoreField = {
  type: Number,
  min: INTERVIEW_SCORE_MIN,
  max: INTERVIEW_SCORE_MAX,
  default: INTERVIEW_SCORE_MIN,
}

const feedbackSchema = new Schema(
  {
    technicalScore: scoreField,
    communicationScore: scoreField,
    cultureFitScore: scoreField,
    leadershipScore: scoreField,
    compensationFit: scoreField,
    joiningRisk: scoreField,
    comments: { type: String, trim: true, maxlength: 4000, default: "" },
  },
  { _id: false }
)

const interviewSchema = new Schema(
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
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: "CandidateSubmission",
      required: true,
      index: true,
    },
    round: {
      type: Number,
      min: 1,
      max: 20,
      default: 1,
    },
    interviewType: {
      type: String,
      enum: INTERVIEW_TYPES,
      required: true,
      default: "VIDEO",
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    duration: {
      type: Number,
      min: INTERVIEW_DURATION_MIN,
      max: INTERVIEW_DURATION_MAX,
      default: INTERVIEW_DURATION_DEFAULT,
    },
    interviewers: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    status: {
      type: String,
      enum: INTERVIEW_STATUSES,
      default: "SCHEDULED",
      index: true,
    },
    feedback: {
      type: feedbackSchema,
      default: () => ({}),
    },
    decision: {
      type: String,
      enum: [...INTERVIEW_DECISIONS, ""],
      default: "",
    },
    nextAction: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    nextActionDeadline: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
)

interviewSchema.index({ organizationId: 1, candidateId: 1, scheduledAt: -1 })
interviewSchema.index({ organizationId: 1, mandateId: 1, scheduledAt: -1 })
interviewSchema.index({ organizationId: 1, submissionId: 1, round: 1 })
interviewSchema.index({ organizationId: 1, status: 1, scheduledAt: -1 })
interviewSchema.index(
  { organizationId: 1, submissionId: 1, round: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: "CANCELLED" } },
  }
)

export const InterviewModel = mongoose.model("Interview", interviewSchema)
