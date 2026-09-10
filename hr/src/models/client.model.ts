import mongoose, { Schema } from "mongoose"

import {
  CLIENT_KYC_STATUSES,
  CLIENT_ONBOARDING_STATUSES,
  CLIENT_STATUSES,
} from "../constants/clients.js"

const contactPersonSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    designation: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: "",
    },
  },
  { _id: true }
)

const clientSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    legalEntityName: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    industry: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    website: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    GSTNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 15,
      default: "",
    },
    PANNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 10,
      default: "",
    },
    registeredAddress: {
      type: String,
      trim: true,
      maxlength: 400,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      maxlength: 400,
      default: "",
    },
    city: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    state: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    country: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    contactPersons: {
      type: [contactPersonSchema],
      default: [],
    },
    status: {
      type: String,
      enum: CLIENT_STATUSES,
      default: "LEAD",
      index: true,
    },
    onboardingStatus: {
      type: String,
      enum: CLIENT_ONBOARDING_STATUSES,
      default: "PENDING",
      index: true,
    },
    KYCStatus: {
      type: String,
      enum: CLIENT_KYC_STATUSES,
      default: "PENDING",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: "",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
)

clientSchema.pre("save", function syncAddress() {
  if (this.isModified("registeredAddress") && this.registeredAddress) {
    this.address = this.registeredAddress
  } else if (this.isModified("address") && this.address && !this.registeredAddress) {
    this.registeredAddress = this.address
  }
})

clientSchema.index({ organizationId: 1, companyName: 1 })
clientSchema.index({ organizationId: 1, status: 1, createdAt: -1 })
clientSchema.index({ organizationId: 1, onboardingStatus: 1 })
clientSchema.index({ organizationId: 1, KYCStatus: 1 })
clientSchema.index(
  { organizationId: 1, GSTNumber: 1 },
  { unique: true, partialFilterExpression: { GSTNumber: { $type: "string", $gt: "" } } }
)
clientSchema.index(
  { organizationId: 1, PANNumber: 1 },
  { unique: true, partialFilterExpression: { PANNumber: { $type: "string", $gt: "" } } }
)

export const ClientModel = mongoose.model("Client", clientSchema)
