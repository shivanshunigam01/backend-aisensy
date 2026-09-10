import mongoose, { Schema } from "mongoose"

import { PAYROLL_STATUSES } from "../constants/payroll.js"

const payrollLineSchema = new Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 40 },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    amount: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false }
)

const payrollSchema = new Schema(
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
    salaryStructureId: {
      type: Schema.Types.ObjectId,
      ref: "SalaryStructure",
      default: null,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
      max: 2100,
    },
    earnings: {
      type: [payrollLineSchema],
      default: [],
    },
    deductions: {
      type: [payrollLineSchema],
      default: [],
    },
    grossSalary: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalDeductions: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    netSalary: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: PAYROLL_STATUSES,
      default: "generated",
      index: true,
    },
    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    paidBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
)

payrollSchema.index({ organizationId: 1, employeeId: 1, year: 1, month: 1 }, { unique: true })
payrollSchema.index({ organizationId: 1, year: 1, month: 1, status: 1 })

export const PayrollModel = mongoose.model("Payroll", payrollSchema)
