import mongoose, { Schema } from "mongoose"

import {
  COMPANY_SIZES,
  DATE_FORMATS,
  DEFAULT_WORKING_DAYS,
  DEFAULT_WORKING_HOURS,
  WEEKDAYS,
} from "../constants/organization.js"

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

const workingHoursSchema = new Schema(
  {
    start: { type: String, default: DEFAULT_WORKING_HOURS.start },
    end: { type: String, default: DEFAULT_WORKING_HOURS.end },
  },
  { _id: false }
)

const settingsSchema = new Schema(
  {
    dateFormat: {
      type: String,
      enum: DATE_FORMATS,
      default: "DD/MM/YYYY",
    },
    weekStartsOn: {
      type: String,
      enum: ["monday", "sunday"],
      default: "monday",
    },
  },
  { _id: false }
)

const organizationSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    logo: {
      type: String,
      trim: true,
      default: "",
    },
    industry: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    companySize: {
      type: String,
      enum: COMPANY_SIZES,
      default: null,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: "",
    },
    address: {
      type: addressSchema,
      default: () => ({}),
    },
    timezone: {
      type: String,
      trim: true,
      default: "Asia/Kolkata",
    },
    workingDays: {
      type: [String],
      enum: WEEKDAYS,
      default: () => [...DEFAULT_WORKING_DAYS],
    },
    workingHours: {
      type: workingHoursSchema,
      default: () => ({ ...DEFAULT_WORKING_HOURS }),
    },
    settings: {
      type: settingsSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
)

export const OrganizationModel = mongoose.model("Organization", organizationSchema)
