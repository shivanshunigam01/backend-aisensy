import mongoose, { Schema } from "mongoose"

import { REVIEW_KINDS, REVIEW_STATUSES } from "../constants/performance.js"

const performanceReviewSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    reviewerId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    kind: {
      type: String,
      enum: REVIEW_KINDS,
      required: true,
      index: true,
    },
    reviewPeriod: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    strengths: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    improvements: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    feedback: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: "",
    },
    status: {
      type: String,
      enum: REVIEW_STATUSES,
      default: "draft",
      index: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
)

performanceReviewSchema.index(
  { organizationId: 1, employeeId: 1, reviewerId: 1, reviewPeriod: 1 },
  { unique: true }
)
performanceReviewSchema.index({ organizationId: 1, employeeId: 1, reviewPeriod: 1, kind: 1 })

export const PerformanceReviewModel = mongoose.model("PerformanceReview", performanceReviewSchema)
