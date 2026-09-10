import mongoose, { Schema } from "mongoose"

import { ATTENDANCE_STATUSES } from "../constants/attendance.js"

const attendanceSchema = new Schema(
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
    date: {
      type: Date,
      required: true,
    },
    checkIn: {
      type: Date,
      default: null,
    },
    checkOut: {
      type: Date,
      default: null,
    },
    breakStartedAt: {
      type: Date,
      default: null,
    },
    breakMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    workingMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    overtimeMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ATTENDANCE_STATUSES,
      required: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    source: {
      type: String,
      enum: ["self", "hr", "system"],
      default: "self",
    },
  },
  { timestamps: true }
)

attendanceSchema.index({ organizationId: 1, date: 1, status: 1 })
attendanceSchema.index({ organizationId: 1, employeeId: 1, date: 1 }, { unique: true })

export const AttendanceModel = mongoose.model("Attendance", attendanceSchema)
