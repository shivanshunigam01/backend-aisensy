import mongoose, { Schema } from "mongoose"

import {
  FOLLOW_UP_CANDIDATE_STATUSES,
  FOLLOW_UP_RISK_LEVELS,
  FOLLOW_UP_TYPES,
  JOINING_PROBABILITY_MAX,
  JOINING_PROBABILITY_MIN,
} from "../constants/follow-ups.js"

const preJoiningFollowUpSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
      index: true,
    },
    offerId: {
      type: Schema.Types.ObjectId,
      ref: "Offer",
      required: true,
      index: true,
    },
    followUpDate: {
      type: Date,
      required: true,
      index: true,
    },
    followUpType: {
      type: String,
      enum: FOLLOW_UP_TYPES,
      required: true,
      default: "CALL",
    },
    candidateStatus: {
      type: String,
      enum: FOLLOW_UP_CANDIDATE_STATUSES,
      required: true,
      default: "POSITIVE",
    },
    joiningProbability: {
      type: Number,
      min: JOINING_PROBABILITY_MIN,
      max: JOINING_PROBABILITY_MAX,
      default: 5,
    },
    riskLevel: {
      type: String,
      enum: FOLLOW_UP_RISK_LEVELS,
      required: true,
      default: "LOW",
      index: true,
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: "",
    },
    nextFollowUpDate: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
)

preJoiningFollowUpSchema.index({ organizationId: 1, offerId: 1, followUpDate: -1 })
preJoiningFollowUpSchema.index({ organizationId: 1, candidateId: 1, followUpDate: -1 })
preJoiningFollowUpSchema.index({ organizationId: 1, riskLevel: 1, followUpDate: -1 })

export const PreJoiningFollowUpModel = mongoose.model(
  "PreJoiningFollowUp",
  preJoiningFollowUpSchema
)
