import mongoose, { Schema } from "mongoose"

import { JOINING_CONFIRMATION_STATUSES } from "../constants/joinings.js"

const joiningSchema = new Schema(
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
    offerId: {
      type: Schema.Types.ObjectId,
      ref: "Offer",
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
      index: true,
    },
    status: {
      type: String,
      enum: JOINING_CONFIRMATION_STATUSES,
      required: true,
      default: "EXPECTED",
      index: true,
    },
    confirmedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    confirmationDate: {
      type: Date,
      default: null,
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

joiningSchema.index({ organizationId: 1, offerId: 1 }, { unique: true })
joiningSchema.index({ organizationId: 1, candidateId: 1, joiningDate: -1 })
joiningSchema.index({ organizationId: 1, clientId: 1, status: 1, joiningDate: -1 })
joiningSchema.index({ organizationId: 1, mandateId: 1, joiningDate: -1 })

export const JoiningModel = mongoose.model("Joining", joiningSchema)
