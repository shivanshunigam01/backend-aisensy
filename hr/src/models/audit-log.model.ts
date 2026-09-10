import mongoose, { Schema } from "mongoose"

import { AUDIT_ACTIONS, AUDIT_MODULES } from "../constants/audit.js"

const auditLogSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    module: {
      type: String,
      enum: AUDIT_MODULES,
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: AUDIT_ACTIONS,
      required: true,
      index: true,
    },
    recordId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    previousData: {
      type: Schema.Types.Mixed,
      default: null,
    },
    newData: {
      type: Schema.Types.Mixed,
      default: null,
    },
    ipAddress: {
      type: String,
      trim: true,
      maxlength: 64,
      default: "",
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
)

auditLogSchema.index({ organizationId: 1, createdAt: -1 })
auditLogSchema.index({ organizationId: 1, module: 1, createdAt: -1 })
auditLogSchema.index({ organizationId: 1, action: 1, createdAt: -1 })

export const AuditLogModel = mongoose.model("AuditLog", auditLogSchema)
