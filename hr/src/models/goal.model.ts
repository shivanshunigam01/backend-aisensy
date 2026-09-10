import mongoose, { Schema } from "mongoose"

import { GOAL_STATUSES } from "../constants/performance.js"

const goalSchema = new Schema(
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
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    deadline: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: GOAL_STATUSES,
      default: "not_started",
      index: true,
    },
  },
  { timestamps: true }
)

goalSchema.index({ organizationId: 1, employeeId: 1, status: 1 })

export const GoalModel = mongoose.model("Goal", goalSchema)
