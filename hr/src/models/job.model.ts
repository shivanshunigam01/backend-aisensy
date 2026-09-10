import mongoose, { Schema } from "mongoose"

import { JOB_EMPLOYMENT_TYPES, JOB_STATUSES } from "../constants/recruitment.js"

const jobSchema = new Schema(
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
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
      index: true,
    },
    location: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    employmentType: {
      type: String,
      enum: JOB_EMPLOYMENT_TYPES,
      required: true,
      default: "full_time",
    },
    description: {
      type: String,
      trim: true,
      maxlength: 8000,
      default: "",
    },
    departmentName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    workMode: {
      type: String,
      trim: true,
      maxlength: 24,
      default: "",
    },
    skills: { type: [String], default: [] },
    experienceMinimum: { type: Number, min: 0, max: 50, default: 0 },
    experienceMaximum: { type: Number, min: 0, max: 50, default: 0 },
    vacancies: { type: Number, min: 1, max: 999, default: 1 },
    status: {
      type: String,
      enum: JOB_STATUSES,
      default: "open",
      index: true,
    },
  },
  { timestamps: true }
)

jobSchema.index({ organizationId: 1, status: 1, createdAt: -1 })
jobSchema.index({ organizationId: 1, title: 1 })
jobSchema.index(
  { organizationId: 1, mandateId: 1 },
  { unique: true, partialFilterExpression: { mandateId: { $type: "objectId" } } }
)

export const JobModel = mongoose.model("Job", jobSchema)
