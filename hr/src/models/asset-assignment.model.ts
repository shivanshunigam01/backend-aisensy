import mongoose, { Schema } from "mongoose"

import { ASSIGNMENT_STATUSES } from "../constants/assets.js"

const assetAssignmentSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    assetId: {
      type: Schema.Types.ObjectId,
      ref: "Asset",
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    assignedDate: {
      type: Date,
      required: true,
    },
    returnedDate: {
      type: Date,
      default: null,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ASSIGNMENT_STATUSES,
      default: "active",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 400,
      default: "",
    },
  },
  { timestamps: true }
)

assetAssignmentSchema.index({ organizationId: 1, assetId: 1, assignedDate: -1 })
assetAssignmentSchema.index(
  { organizationId: 1, assetId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
)

export const AssetAssignmentModel = mongoose.model("AssetAssignment", assetAssignmentSchema)
