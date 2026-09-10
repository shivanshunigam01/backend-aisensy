import mongoose, { Schema } from "mongoose"

const holidaySchema = new Schema(
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
      maxlength: 120,
    },
    date: {
      type: Date,
      required: true,
    },
    region: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "Company-wide",
    },
  },
  { timestamps: true }
)

holidaySchema.index({ organizationId: 1, date: 1 })

export const HolidayModel = mongoose.model("Holiday", holidaySchema)
