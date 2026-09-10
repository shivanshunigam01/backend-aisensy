import mongoose, { Schema } from "mongoose"

import { LEAVE_REQUEST_STATUSES } from "../constants/leave.js"

const leaveRequestSchema = new Schema(
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
    leaveTypeId: {
      type: Schema.Types.ObjectId,
      ref: "LeaveType",
      required: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    totalDays: {
      type: Number,
      required: true,
      min: 0.5,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    attachment: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    status: {
      type: String,
      enum: LEAVE_REQUEST_STATUSES,
      default: "pending",
      index: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvalComment: {
      type: String,
      trim: true,
      maxlength: 400,
      default: "",
    },
  },
  { timestamps: true }
)

leaveRequestSchema.index({ organizationId: 1, status: 1, startDate: 1, endDate: 1 })
leaveRequestSchema.index({ organizationId: 1, employeeId: 1, startDate: 1, endDate: 1 })

export const LeaveRequestModel = mongoose.model("LeaveRequest", leaveRequestSchema)
