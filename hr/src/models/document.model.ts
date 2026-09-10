import mongoose, { Schema } from "mongoose"

import { DOCUMENT_STATUSES, DOCUMENT_TYPES } from "../constants/documents.js"

const documentSchema = new Schema(
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
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    type: {
      type: String,
      enum: DOCUMENT_TYPES,
      required: true,
      index: true,
    },
    fileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    publicId: {
      type: String,
      required: true,
      trim: true,
    },
    resourceType: {
      type: String,
      default: "raw",
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    fileSize: {
      type: Number,
      required: true,
      min: 0,
    },
    expiryDate: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: DOCUMENT_STATUSES,
      default: "active",
      index: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
)

documentSchema.index({ organizationId: 1, employeeId: 1, uploadedAt: -1 })
documentSchema.index({ organizationId: 1, status: 1, expiryDate: 1 })

export const DocumentModel = mongoose.model("Document", documentSchema)
