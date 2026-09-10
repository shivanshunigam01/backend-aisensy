import mongoose, { Schema } from "mongoose"

const leaveTypeSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    maxDays: {
      type: Number,
      required: true,
      min: 0,
      max: 365,
    },
    isPaid: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
)

leaveTypeSchema.index({ organizationId: 1, code: 1 }, { unique: true })
leaveTypeSchema.index({ organizationId: 1, name: 1 }, { unique: true })

export const LeaveTypeModel = mongoose.model("LeaveType", leaveTypeSchema)
