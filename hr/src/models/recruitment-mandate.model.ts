import mongoose, { Schema } from "mongoose"

import { EMPLOYMENT_TYPES } from "../constants/employees.js"
import {
  DEFAULT_SALARY_CURRENCY,
  MANDATE_FEE_TYPES,
  MANDATE_PRIORITIES,
  MANDATE_STATUSES,
  MANDATE_WORK_MODES,
} from "../constants/mandates.js"
import {
  DEFAULT_PAYMENT_TERMS_DAYS,
  DEFAULT_REPLACEMENT_PERIOD_DAYS,
} from "../constants/agreements.js"

const experienceSchema = new Schema(
  {
    minimum: { type: Number, min: 0, max: 50, default: 0 },
    maximum: { type: Number, min: 0, max: 50, default: 0 },
  },
  { _id: false }
)

const salarySchema = new Schema(
  {
    minimum: { type: Number, min: 0, default: 0 },
    maximum: { type: Number, min: 0, default: 0 },
    currency: { type: String, trim: true, uppercase: true, maxlength: 8, default: DEFAULT_SALARY_CURRENCY },
    fixedPercent: { type: Number, min: 0, max: 100, default: null },
    variablePercent: { type: Number, min: 0, max: 100, default: null },
  },
  { _id: false }
)

const recruitmentMandateSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },
    agreementId: {
      type: Schema.Types.ObjectId,
      ref: "ClientAgreement",
      default: null,
      index: true,
    },
    mandateNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 24,
    },
    position: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    department: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    employmentType: {
      type: String,
      enum: EMPLOYMENT_TYPES,
      required: true,
      default: "full_time",
    },
    vacancies: {
      type: Number,
      min: 1,
      max: 999,
      default: 1,
    },
    location: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    workMode: {
      type: String,
      enum: MANDATE_WORK_MODES,
      default: "ONSITE",
    },
    reportingTo: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    experience: {
      type: experienceSchema,
      default: () => ({ minimum: 0, maximum: 0 }),
    },
    salary: {
      type: salarySchema,
      default: () => ({ minimum: 0, maximum: 0, currency: DEFAULT_SALARY_CURRENCY }),
    },
    qualifications: { type: [String], default: [] },
    /** @deprecated Prefer mustHaveSkills + preferredSkills. Kept for backward compatibility. */
    skills: { type: [String], default: [] },
    mustHaveSkills: { type: [String], default: [] },
    preferredSkills: { type: [String], default: [] },
    responsibilities: { type: [String], default: [] },
    criticalRequirements: { type: [String], default: [] },
    interviewProcess: { type: [String], default: [] },
    industryPreference: { type: String, trim: true, maxlength: 160, default: "" },
    teamSize: { type: String, trim: true, maxlength: 120, default: "" },
    acceptedNoticePeriod: { type: String, trim: true, maxlength: 80, default: "" },
    travelRequirement: { type: String, trim: true, maxlength: 240, default: "" },
    workingDaysHours: { type: String, trim: true, maxlength: 240, default: "" },
    targetJoiningDate: { type: Date, default: null },
    paymentTermsDays: { type: Number, min: 0, max: 365, default: DEFAULT_PAYMENT_TERMS_DAYS },
    exclusivity: { type: Boolean, default: false },
    specialInstructions: { type: String, trim: true, maxlength: 4000, default: "" },
    assignedRecruiters: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    recruitmentFee: {
      type: Number,
      min: 0,
      default: 0,
    },
    feeType: {
      type: String,
      enum: MANDATE_FEE_TYPES,
      default: "PERCENTAGE",
    },
    replacementPeriodDays: {
      type: Number,
      min: 0,
      max: 730,
      default: DEFAULT_REPLACEMENT_PERIOD_DAYS,
    },
    priority: {
      type: String,
      enum: MANDATE_PRIORITIES,
      default: "MEDIUM",
      index: true,
    },
    status: {
      type: String,
      enum: MANDATE_STATUSES,
      default: "DRAFT",
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
)

recruitmentMandateSchema.index({ organizationId: 1, mandateNumber: 1 }, { unique: true })
recruitmentMandateSchema.index({ organizationId: 1, status: 1, createdAt: -1 })
recruitmentMandateSchema.index({ organizationId: 1, clientId: 1, createdAt: -1 })
recruitmentMandateSchema.index({ organizationId: 1, agreementId: 1, createdAt: -1 })
recruitmentMandateSchema.index({ organizationId: 1, position: 1 })
recruitmentMandateSchema.index({ organizationId: 1, assignedRecruiters: 1 })
recruitmentMandateSchema.index({ status: 1, isPublic: 1, createdAt: -1 })

export const RecruitmentMandateModel = mongoose.model("RecruitmentMandate", recruitmentMandateSchema)
