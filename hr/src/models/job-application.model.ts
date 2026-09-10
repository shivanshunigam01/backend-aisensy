import mongoose, { Schema } from "mongoose"

import {
  JOB_APPLICATION_SOURCES,
  JOB_APPLICATION_STATUSES,
} from "../constants/job-applications.js"

const jobApplicationSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    mandateId: {
      type: Schema.Types.ObjectId,
      ref: "RecruitmentMandate",
      required: true,
      index: true,
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
      index: true,
    },
    applicationNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 24,
    },
    source: {
      type: String,
      enum: JOB_APPLICATION_SOURCES,
      default: "CAREER_PAGE",
      index: true,
    },
    status: {
      type: String,
      enum: JOB_APPLICATION_STATUSES,
      default: "APPLIED",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: "",
    },
    appliedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true }
)

jobApplicationSchema.index({ organizationId: 1, applicationNumber: 1 }, { unique: true })
jobApplicationSchema.index({ organizationId: 1, mandateId: 1, candidateId: 1 }, { unique: true })
jobApplicationSchema.index({ organizationId: 1, status: 1, appliedAt: -1 })

export const JobApplicationModel = mongoose.model("JobApplication", jobApplicationSchema)
