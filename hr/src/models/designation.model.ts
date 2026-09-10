import mongoose, { Schema } from "mongoose"

const designationSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 400,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
)

designationSchema.index(
  { organizationId: 1, departmentId: 1, title: 1 },
  { unique: true }
)

export const DesignationModel = mongoose.model("Designation", designationSchema)
