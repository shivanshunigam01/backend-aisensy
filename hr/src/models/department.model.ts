import mongoose, { Schema } from "mongoose"

const departmentSchema = new Schema(
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
      minlength: 2,
      maxlength: 80,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 400,
      default: "",
    },
    headId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
)

departmentSchema.index({ organizationId: 1, code: 1 }, { unique: true })
departmentSchema.index({ organizationId: 1, name: 1 }, { unique: true })

export const DepartmentModel = mongoose.model("Department", departmentSchema)
