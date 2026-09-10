import mongoose, { Schema } from "mongoose"

import { ACTIVITY_TONES } from "../constants/dashboard.js"

const activitySchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    detail: {
      type: String,
      trim: true,
      maxlength: 240,
      default: "",
    },
    tone: {
      type: String,
      enum: ACTIVITY_TONES,
      default: "default",
    },
  },
  { timestamps: true }
)

activitySchema.index({ organizationId: 1, createdAt: -1 })

export const ActivityModel = mongoose.model("Activity", activitySchema)
