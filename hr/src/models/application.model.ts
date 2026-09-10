import mongoose, { Schema } from "mongoose"

import { APPLICATION_STAGES } from "../constants/recruitment.js"

const applicationSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    jobId: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true,
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
      index: true,
    },
    stage: {
      type: String,
      enum: APPLICATION_STAGES,
      default: "applied",
      index: true,
    },
    appliedDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: "",
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
)

applicationSchema.index({ organizationId: 1, jobId: 1, candidateId: 1 }, { unique: true })
applicationSchema.index({ organizationId: 1, jobId: 1, stage: 1, sortOrder: 1 })

export const ApplicationModel = mongoose.model("Application", applicationSchema)
