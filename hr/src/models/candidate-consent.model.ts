import mongoose, { Schema } from "mongoose"

import {
  CANDIDATE_CONSENT_METHODS,
  CANDIDATE_CONSENT_PURPOSES,
} from "../constants/candidates.js"

const consentDocumentSchema = new Schema(
  {
    fileUrl: { type: String, trim: true, maxlength: 500, default: "" },
    fileName: { type: String, trim: true, maxlength: 200, default: "" },
  },
  { _id: false }
)

const candidateConsentSchema = new Schema(
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
    consentGiven: {
      type: Boolean,
      default: true,
      index: true,
    },
    consentDate: {
      type: Date,
      default: null,
    },
    consentMethod: {
      type: String,
      enum: [...CANDIDATE_CONSENT_METHODS, ""],
      default: "FORM",
    },
    consentPurpose: {
      type: String,
      enum: CANDIDATE_CONSENT_PURPOSES,
      default: "SOURCING",
    },
    consentDocument: {
      type: consentDocumentSchema,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    withdrawnAt: {
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

candidateConsentSchema.index({ organizationId: 1, candidateId: 1, createdAt: -1 })
candidateConsentSchema.index({ organizationId: 1, mandateId: 1, createdAt: -1 })
candidateConsentSchema.index(
  { organizationId: 1, candidateId: 1, mandateId: 1 },
  {
    unique: true,
    partialFilterExpression: { consentGiven: true, withdrawnAt: null },
  }
)

export const CandidateConsentModel = mongoose.model("CandidateConsent", candidateConsentSchema)
