import mongoose, { Schema } from "mongoose"

import {
  DEFAULT_INTERVIEW_EXPIRY_HOURS,
  DEFAULT_PASSING_SCORE,
} from "../constants/ai-interviews.js"

const aiInterviewConfigSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
      index: true,
    },
    passingScore: {
      type: Number,
      min: 0,
      max: 100,
      default: DEFAULT_PASSING_SCORE,
    },
    interviewExpiryHours: {
      type: Number,
      min: 1,
      max: 720,
      default: DEFAULT_INTERVIEW_EXPIRY_HOURS,
    },
    autoTriggerOnApply: { type: Boolean, default: true },
    interviewMode: {
      type: String,
      enum: ["TEXT", "VOICE", "BOTH"],
      default: "BOTH",
    },
  },
  { timestamps: true }
)

export const AIInterviewConfigModel = mongoose.model("AIInterviewConfig", aiInterviewConfigSchema)
