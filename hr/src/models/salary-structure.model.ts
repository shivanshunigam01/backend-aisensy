import mongoose, { Schema } from "mongoose"

const salaryStructureSchema = new Schema(
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
    basicSalary: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    hra: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    allowances: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    bonus: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    deductions: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    effectiveFrom: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
)

salaryStructureSchema.index(
  { organizationId: 1, employeeId: 1, effectiveFrom: 1 },
  { unique: true }
)
salaryStructureSchema.index({ organizationId: 1, employeeId: 1, effectiveFrom: -1 })

export const SalaryStructureModel = mongoose.model("SalaryStructure", salaryStructureSchema)
