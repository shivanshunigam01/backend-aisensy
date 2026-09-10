import mongoose, { Schema } from "mongoose"

import { AI_INTERVIEW_RESULTS } from "../constants/ai-interviews.js"

const aiInterviewEvaluationSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    interviewId: {
      type: Schema.Types.ObjectId,
      ref: "AIInterview",
      required: true,
      unique: true,
      index: true,
    },
    technicalScore: { type: Number, min: 0, max: 100, default: 0 },
    communicationScore: { type: Number, min: 0, max: 100, default: 0 },
    problemSolvingScore: { type: Number, min: 0, max: 100, default: 0 },
    relevanceScore: { type: Number, min: 0, max: 100, default: 0 },
    finalScore: { type: Number, min: 0, max: 100, default: 0 },
    result: {
      type: String,
      enum: AI_INTERVIEW_RESULTS,
      default: "PENDING",
    },
    overallFeedback: { type: String, trim: true, maxlength: 8000, default: "" },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    recommendation: { type: String, trim: true, maxlength: 2000, default: "" },
    rawEvaluation: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
)

export const AIInterviewEvaluationModel = mongoose.model(
  "AIInterviewEvaluation",
  aiInterviewEvaluationSchema
)
