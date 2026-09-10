import mongoose, { Schema } from "mongoose"

import {
  OWNERSHIP_STATUSES,
  SUBMISSION_ACTIVE_STATUSES,
  SUBMISSION_DUPLICATE_STATUSES,
  SUBMISSION_STATUSES,
} from "../constants/submissions.js"

const candidateSubmissionSchema = new Schema(
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
    clientId: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },
    mandateId: {
      type: Schema.Types.ObjectId,
      ref: "RecruitmentMandate",
      required: true,
      index: true,
    },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "Application",
      default: null,
      index: true,
    },
    evaluationId: {
      type: Schema.Types.ObjectId,
      ref: "CandidateEvaluation",
      default: null,
      index: true,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    ownershipStartDate: {
      type: Date,
      default: null,
    },
    ownershipEndDate: {
      type: Date,
      default: null,
    },
    ownershipStatus: {
      type: String,
      enum: [...OWNERSHIP_STATUSES, ""],
      default: "",
      index: true,
    },
    ownershipOverridden: {
      type: Boolean,
      default: false,
    },
    firstIntroducedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    clientAcknowledgement: {
      type: Boolean,
      default: false,
    },
    acknowledgementDate: {
      type: Date,
      default: null,
    },
    duplicateStatus: {
      type: String,
      enum: SUBMISSION_DUPLICATE_STATUSES,
      default: "NOT_CHECKED",
      index: true,
    },
    duplicateEvidence: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: "",
    },
    duplicateNotificationDeadline: {
      type: Date,
      default: null,
    },
    duplicateReportedAt: {
      type: Date,
      default: null,
    },
    duplicateReportedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    duplicateLateReport: {
      type: Boolean,
      default: false,
    },
    duplicateResolution: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: "",
    },
    /** Snapshot fields for the submission pack */
    currentCompany: { type: String, trim: true, maxlength: 160, default: "" },
    currentDesignation: { type: String, trim: true, maxlength: 160, default: "" },
    currentLocation: { type: String, trim: true, maxlength: 160, default: "" },
    totalExperience: { type: Number, min: 0, max: 50, default: null },
    currentCTC: { type: Number, min: 0, default: null },
    expectedCTC: { type: Number, min: 0, default: null },
    noticePeriod: { type: String, trim: true, maxlength: 40, default: "" },
    evaluationScore: { type: Number, min: 0, max: 100, default: null },
    fitReasons: {
      type: [{ type: String, trim: true, maxlength: 240 }],
      default: [],
      validate: {
        validator(value: string[]) {
          return !value || value.length <= 3
        },
        message: "At most 3 fit reasons are allowed",
      },
    },
    risksGaps: {
      type: [{ type: String, trim: true, maxlength: 500 }],
      default: [],
    },
    status: {
      type: String,
      enum: SUBMISSION_STATUSES,
      default: "DRAFT",
      index: true,
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

candidateSubmissionSchema.index({ organizationId: 1, candidateId: 1, createdAt: -1 })
candidateSubmissionSchema.index({ organizationId: 1, mandateId: 1, createdAt: -1 })
candidateSubmissionSchema.index({ organizationId: 1, clientId: 1, createdAt: -1 })
candidateSubmissionSchema.index({ organizationId: 1, status: 1, createdAt: -1 })
candidateSubmissionSchema.index({ organizationId: 1, clientId: 1, candidateId: 1, ownershipStartDate: -1 })
candidateSubmissionSchema.index(
  { organizationId: 1, candidateId: 1, mandateId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: [...SUBMISSION_ACTIVE_STATUSES] } },
  }
)

export const CandidateSubmissionModel = mongoose.model(
  "CandidateSubmission",
  candidateSubmissionSchema
)
