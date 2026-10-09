import mongoose, { Schema } from "mongoose"

import {
  CANDIDATE_CONSENT_METHODS,
  CANDIDATE_SOURCES,
  CANDIDATE_STATUSES,
} from "../constants/candidates.js"

const consentSchema = new Schema(
  {
    given: { type: Boolean, default: false },
    date: { type: Date, default: null },
    method: {
      type: String,
      enum: [...CANDIDATE_CONSENT_METHODS, ""],
      default: "",
    },
  },
  { _id: false }
)

const candidateSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    candidateNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 24,
      default: "",
    },
    firstName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: "",
    },
    resumeUrl: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    resume: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    resumeFileName: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    resumePublicId: {
      type: String,
      trim: true,
      default: "",
    },
    currentCompany: { type: String, trim: true, maxlength: 160, default: "" },
    currentDesignation: { type: String, trim: true, maxlength: 160, default: "" },
    totalExperience: { type: Number, min: 0, max: 50, default: 0 },
    relevantExperience: { type: Number, min: 0, max: 50, default: 0 },
    experience: { type: Number, min: 0, max: 50, default: 0 },
    currentCTC: { type: Number, min: 0, default: 0 },
    expectedCTC: { type: Number, min: 0, default: 0 },
    noticePeriod: { type: String, trim: true, maxlength: 40, default: "" },
    currentLocation: { type: String, trim: true, maxlength: 160, default: "" },
    preferredLocations: { type: [String], default: [] },
    linkedInUrl: { type: String, trim: true, maxlength: 300, default: "" },
    skills: { type: [String], default: [] },
    qualifications: { type: [String], default: [] },
    source: {
      type: String,
      enum: CANDIDATE_SOURCES,
      default: "DIRECT",
    },
    consent: {
      type: consentSchema,
      default: () => ({ given: false, date: null, method: "" }),
    },
    status: {
      type: String,
      enum: CANDIDATE_STATUSES,
      default: "NEW",
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
)

candidateSchema.index({ organizationId: 1, email: 1 }, { unique: true })
candidateSchema.index(
  { organizationId: 1, candidateNumber: 1 },
  { unique: true, partialFilterExpression: { candidateNumber: { $type: "string", $gt: "" } } }
)
candidateSchema.index({ organizationId: 1, name: 1 })
candidateSchema.index({ organizationId: 1, firstName: 1, lastName: 1 })
candidateSchema.index({ organizationId: 1, status: 1, createdAt: -1 })
candidateSchema.index({ organizationId: 1, skills: 1 })
candidateSchema.index(
  { organizationId: 1, phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string", $gt: "" } } }
)

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] ?? name,
    lastName: parts.slice(1).join(" "),
  }
}

candidateSchema.pre("save", function syncDerivedFields() {
  const first = this.firstName?.trim() ?? ""
  const last = this.lastName?.trim() ?? ""
  const full = `${first} ${last}`.trim()

  if (full) {
    this.name = full
  } else if (this.name) {
    const parts = splitName(this.name)
    this.firstName = parts.firstName
    this.lastName = parts.lastName
  }

  if (this.resumeUrl && !this.resume) {
    this.resume = this.resumeUrl
  } else if (this.resume && !this.resumeUrl) {
    this.resumeUrl = this.resume
  }

  if (this.isModified("totalExperience") && !this.isModified("experience")) {
    this.experience = this.totalExperience
  } else if (this.isModified("experience") && !this.isModified("totalExperience")) {
    this.totalExperience = this.experience
  }

  if (this.consent?.given && !this.consent.date) {
    this.consent.date = new Date()
  }
})

export const CandidateModel = mongoose.model("Candidate", candidateSchema)
