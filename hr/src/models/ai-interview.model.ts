import mongoose, { Schema } from "mongoose"

import {
  AI_INTERVIEW_JOB_TYPES,
  AI_INTERVIEW_RESULTS,
  AI_INTERVIEW_STATUSES,
} from "../constants/ai-interviews.js"

const resumeAnalysisSchema = new Schema(
  {
    candidateName: { type: String, trim: true, default: "" },
    skills: { type: [String], default: [] },
    experience: { type: [String], default: [] },
    projects: { type: [String], default: [] },
    education: { type: [String], default: [] },
    technologies: { type: [String], default: [] },
    strengths: { type: [String], default: [] },
    missingSkills: { type: [String], default: [] },
    jobMatchScore: { type: Number, min: 0, max: 100, default: 0 },
    rawAnalysis: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false }
)

const aiInterviewSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    applicationId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    applicationType: {
      type: String,
      enum: ["JOB_APPLICATION", "APPLICATION"],
      default: "JOB_APPLICATION",
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
      index: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    jobType: {
      type: String,
      enum: AI_INTERVIEW_JOB_TYPES,
      default: "MANDATE",
    },
    uniqueToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    resumeAnalysis: {
      type: resumeAnalysisSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: AI_INTERVIEW_STATUSES,
      default: "SCHEDULED",
      index: true,
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
    finalScore: { type: Number, min: 0, max: 100, default: null },
    result: {
      type: String,
      enum: AI_INTERVIEW_RESULTS,
      default: "PENDING",
      index: true,
    },
    overriddenResult: {
      type: String,
      enum: [...AI_INTERVIEW_RESULTS, ""],
      default: "",
    },
    overrideReason: { type: String, trim: true, maxlength: 2000, default: "" },
    overriddenBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    overriddenAt: { type: Date, default: null },
    invitationSentAt: { type: Date, default: null },
    passingScoreUsed: { type: Number, min: 0, max: 100, default: 70 },
  },
  { timestamps: true }
)

aiInterviewSchema.index({ organizationId: 1, applicationId: 1 })
aiInterviewSchema.index({ organizationId: 1, status: 1, createdAt: -1 })
aiInterviewSchema.index({ organizationId: 1, candidateId: 1, jobId: 1 })

export const AIInterviewModel = mongoose.model("AIInterview", aiInterviewSchema)
