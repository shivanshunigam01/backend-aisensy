import mongoose, { Schema } from "mongoose"

import {
  REPLACEMENT_ELIGIBILITY_RESULTS,
  REPLACEMENT_OPEN_STATUSES,
  REPLACEMENT_REASONS,
  REPLACEMENT_STATUSES,
} from "../constants/replacements.js"

const replacementCaseSchema = new Schema(
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
    joiningId: {
      type: Schema.Types.ObjectId,
      ref: "Joining",
      required: true,
      index: true,
    },
    replacementReason: {
      type: String,
      enum: REPLACEMENT_REASONS,
      required: true,
    },
    replacementRequestedDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: REPLACEMENT_STATUSES,
      required: true,
      default: "REPLACEMENT_REQUESTED",
      index: true,
    },
    replacementCandidateId: {
      type: Schema.Types.ObjectId,
      ref: "Candidate",
      default: null,
      index: true,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    eligibilityResult: {
      type: String,
      enum: [...REPLACEMENT_ELIGIBILITY_RESULTS, ""],
      default: "",
      index: true,
    },
    eligibilityReasons: {
      type: [String],
      default: [],
    },
    freeReplacement: {
      type: Boolean,
      default: false,
    },
    freeReplacementUsed: {
      type: Boolean,
      default: false,
    },
    replacementCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    mandateReopenedAt: {
      type: Date,
      default: null,
    },
    manualOverride: {
      type: Boolean,
      default: false,
    },
    exclusions: {
      type: new Schema(
        {
          salaryDelayed: { type: Boolean, default: false },
          roleChanged: { type: Boolean, default: false },
          locationChanged: { type: Boolean, default: false },
          compensationChanged: { type: Boolean, default: false },
          retrenchment: { type: Boolean, default: false },
          redundancy: { type: Boolean, default: false },
          businessClosure: { type: Boolean, default: false },
          restructuring: { type: Boolean, default: false },
          unsafeConditions: { type: Boolean, default: false },
          clientMisconduct: { type: Boolean, default: false },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: "",
    },
  },
  { timestamps: true }
)

replacementCaseSchema.index(
  { organizationId: 1, joiningId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: [...REPLACEMENT_OPEN_STATUSES] } },
  }
)
replacementCaseSchema.index({ organizationId: 1, clientId: 1, replacementRequestedDate: -1 })
replacementCaseSchema.index({ organizationId: 1, status: 1, replacementRequestedDate: -1 })

export const ReplacementCaseModel = mongoose.model("ReplacementCase", replacementCaseSchema)
