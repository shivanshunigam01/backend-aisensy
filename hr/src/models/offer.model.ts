import mongoose, { Schema } from "mongoose"

import { JOINING_STATUSES, OFFER_ACTIVE_STATUSES, OFFER_STATUSES } from "../constants/offers.js"

const offerSchema = new Schema(
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
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: "CandidateSubmission",
      required: true,
      index: true,
    },
    selectedDate: {
      type: Date,
      default: null,
    },
    offeredDesignation: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    offeredCTC: {
      type: Number,
      min: 0,
      default: 0,
    },
    offerDate: {
      type: Date,
      default: null,
    },
    offerStatus: {
      type: String,
      enum: OFFER_STATUSES,
      default: "DRAFT",
      index: true,
    },
    expectedJoiningDate: {
      type: Date,
      default: null,
    },
    actualJoiningDate: {
      type: Date,
      default: null,
    },
    joiningStatus: {
      type: String,
      enum: JOINING_STATUSES,
      default: "PENDING",
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

offerSchema.index({ organizationId: 1, candidateId: 1, createdAt: -1 })
offerSchema.index({ organizationId: 1, mandateId: 1, createdAt: -1 })
offerSchema.index({ organizationId: 1, submissionId: 1, createdAt: -1 })
offerSchema.index({ organizationId: 1, offerStatus: 1, createdAt: -1 })
offerSchema.index(
  { organizationId: 1, submissionId: 1 },
  {
    unique: true,
    partialFilterExpression: { offerStatus: { $in: [...OFFER_ACTIVE_STATUSES] } },
  }
)

export const OfferModel = mongoose.model("Offer", offerSchema)
