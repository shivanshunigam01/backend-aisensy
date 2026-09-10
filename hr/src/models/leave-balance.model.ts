import mongoose, { Schema } from "mongoose"

const leaveBalanceSchema = new Schema(
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
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    used: {
      type: Number,
      default: 0,
      min: 0,
    },
    remaining: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
)

leaveBalanceSchema.index(
  { organizationId: 1, employeeId: 1, leaveTypeId: 1, year: 1 },
  { unique: true }
)

export const LeaveBalanceModel = mongoose.model("LeaveBalance", leaveBalanceSchema)
