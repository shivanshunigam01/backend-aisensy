import mongoose, { Schema } from "mongoose"

import {
  AI_QUESTION_CATEGORIES,
  AI_QUESTION_DIFFICULTIES,
} from "../constants/ai-interviews.js"

const questionEvaluationSchema = new Schema(
  {
    technicalAccuracy: { type: Number, min: 0, max: 100, default: 0 },
    communication: { type: Number, min: 0, max: 100, default: 0 },
    problemSolving: { type: Number, min: 0, max: 100, default: 0 },
    relevance: { type: Number, min: 0, max: 100, default: 0 },
  },
  { _id: false }
)

const aiInterviewQuestionSchema = new Schema(
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
      index: true,
    },
    order: { type: Number, min: 1, max: 20, required: true },
    question: { type: String, required: true, trim: true, maxlength: 4000 },
    category: {
      type: String,
      enum: AI_QUESTION_CATEGORIES,
      default: "TECHNICAL",
    },
    difficulty: {
      type: String,
      enum: AI_QUESTION_DIFFICULTIES,
      default: "MEDIUM",
    },
    candidateAnswer: { type: String, trim: true, maxlength: 16000, default: "" },
    answerMode: {
      type: String,
      enum: ["TEXT", "VOICE", ""],
      default: "",
    },
    score: { type: Number, min: 0, max: 100, default: null },
    feedback: { type: String, trim: true, maxlength: 4000, default: "" },
    evaluation: {
      type: questionEvaluationSchema,
      default: () => ({}),
    },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

aiInterviewQuestionSchema.index({ interviewId: 1, order: 1 }, { unique: true })

export const AIInterviewQuestionModel = mongoose.model(
  "AIInterviewQuestion",
  aiInterviewQuestionSchema
)
