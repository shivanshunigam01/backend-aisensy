import mongoose, { Schema } from "mongoose"

import {
  EMERGENCY_RELATIONSHIPS,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  GENDERS,
  WORK_LOCATIONS,
} from "../constants/employees.js"

const addressSchema = new Schema(
  {
    line1: { type: String, trim: true, maxlength: 160, default: "" },
    line2: { type: String, trim: true, maxlength: 160, default: "" },
    city: { type: String, trim: true, maxlength: 80, default: "" },
    state: { type: String, trim: true, maxlength: 80, default: "" },
    postalCode: { type: String, trim: true, maxlength: 20, default: "" },
    country: { type: String, trim: true, maxlength: 80, default: "" },
  },
  { _id: false }
)

const emergencyContactSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 120, default: "" },
    relationship: {
      type: String,
      enum: [...EMERGENCY_RELATIONSHIPS, null],
      default: null,
    },
    phone: { type: String, trim: true, maxlength: 30, default: "" },
  },
  { _id: false }
)

const employeeSchema = new Schema(
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
      unique: true,
    },
    employeeCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    profileImage: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: "",
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: [...GENDERS, null],
      default: null,
    },
    address: {
      type: addressSchema,
      default: () => ({}),
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      default: null,
      index: true,
    },
    designationId: {
      type: Schema.Types.ObjectId,
      ref: "Designation",
      default: null,
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
      index: true,
    },
    joiningDate: {
      type: Date,
      default: null,
    },
    employmentType: {
      type: String,
      enum: EMPLOYMENT_TYPES,
      default: "full_time",
    },
    employmentStatus: {
      type: String,
      enum: EMPLOYMENT_STATUSES,
      default: "active",
      index: true,
    },
    workLocation: {
      type: String,
      enum: WORK_LOCATIONS,
      default: "office",
    },
    emergencyContact: {
      type: emergencyContactSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
)

employeeSchema.index({ organizationId: 1, employeeCode: 1 }, { unique: true })
employeeSchema.index({ organizationId: 1, firstName: 1, lastName: 1 })
employeeSchema.index({ organizationId: 1, dateOfBirth: 1 })
employeeSchema.index({ organizationId: 1, createdAt: 1 })

export const EmployeeModel = mongoose.model("Employee", employeeSchema)
