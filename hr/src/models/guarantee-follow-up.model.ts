import mongoose, { Schema } from "mongoose"

import {
  GUARANTEE_MILESTONE_STATUSES,
  RETENTION_STATUSES,
} from "../constants/guarantees.js"

const milestoneSchema = new Schema(
  {
    status: {
      type: String,
      enum: GUARANTEE_MILESTONE_STATUSES,
      default: "PENDING",
    },
    completedAt: {
      type: Date,
      default: null,
    },
    clientFeedback: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: "",
    },
    candidateFeedback: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: "",
    },
  },
  { _id: false }
)

const guaranteeFollowUpSchema = new Schema(
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
    joiningId: {
      type: Schema.Types.ObjectId,
      ref: "Joining",
      required: true,
      index: true,
    },
    mandateId: {
      type: Schema.Types.ObjectId,
      ref: "RecruitmentMandate",
      required: true,
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },
    joiningDate: {
      type: Date,
      required: true,
    },
    guaranteeStartDate: {
      type: Date,
      required: true,
    },
    guaranteeEndDate: {
      type: Date,
      required: true,
      index: true,
    },
    milestone30: {
      type: milestoneSchema,
      default: () => ({}),
    },
    milestone60: {
      type: milestoneSchema,
      default: () => ({}),
    },
    milestone90: {
      type: milestoneSchema,
      default: () => ({}),
    },
    /** Which milestones apply for this guarantee window (derived from replacementPeriodDays). */
    milestone30Enabled: { type: Boolean, default: true },
    milestone60Enabled: { type: Boolean, default: true },
    milestone90Enabled: { type: Boolean, default: true },
    replacementPeriodDays: { type: Number, min: 0, max: 730, default: null },
    retentionStatus: {
      type: String,
      enum: RETENTION_STATUSES,
      required: true,
      default: "IN_PROGRESS",
      index: true,
    },
  },
  { timestamps: true }
)

guaranteeFollowUpSchema.index({ organizationId: 1, joiningId: 1 }, { unique: true })
guaranteeFollowUpSchema.index({ organizationId: 1, clientId: 1, guaranteeEndDate: -1 })
guaranteeFollowUpSchema.index({ organizationId: 1, candidateId: 1, guaranteeEndDate: -1 })
guaranteeFollowUpSchema.index({ organizationId: 1, retentionStatus: 1, guaranteeEndDate: -1 })

export const GuaranteeFollowUpModel = mongoose.model(
  "GuaranteeFollowUp",
  guaranteeFollowUpSchema
)
