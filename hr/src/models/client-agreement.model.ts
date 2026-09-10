import mongoose, { Schema } from "mongoose"

import {
  AGREEMENT_FEE_TYPES,
  AGREEMENT_STATUSES,
  DEFAULT_DUPLICATE_NOTIFICATION_DAYS,
  DEFAULT_GST_RATE_PERCENT,
  DEFAULT_OWNERSHIP_PERIOD_MONTHS,
  DEFAULT_PAYMENT_TERMS_DAYS,
  DEFAULT_REPLACEMENT_PERIOD_DAYS,
} from "../constants/agreements.js"
import { GST_SPLIT_MODES } from "../constants/invoices.js"

const commercialTermsSchema = new Schema(
  {
    recruitmentFee: { type: Number, min: 0, default: 0 },
    feeType: { type: String, enum: AGREEMENT_FEE_TYPES, default: "PERCENTAGE" },
    paymentTermsDays: { type: Number, min: 0, max: 365, default: DEFAULT_PAYMENT_TERMS_DAYS },
    gstRatePercent: { type: Number, min: 0, max: 100, default: DEFAULT_GST_RATE_PERCENT },
    gstSplitMode: { type: String, enum: GST_SPLIT_MODES, default: "CGST_SGST" },
  },
  { _id: false }
)

const signedDocumentSchema = new Schema(
  {
    fileUrl: { type: String, trim: true, maxlength: 500, default: "" },
    fileName: { type: String, trim: true, maxlength: 200, default: "" },
  },
  { _id: false }
)

const clientAgreementSchema = new Schema(
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
    agreementNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 24,
    },
    effectiveDate: {
      type: Date,
      required: true,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    signedDate: {
      type: Date,
      default: null,
    },
    commercialTerms: {
      type: commercialTermsSchema,
      default: () => ({
        recruitmentFee: 0,
        feeType: "PERCENTAGE",
        paymentTermsDays: DEFAULT_PAYMENT_TERMS_DAYS,
        gstRatePercent: DEFAULT_GST_RATE_PERCENT,
        gstSplitMode: "CGST_SGST",
      }),
    },
    ownershipPeriodMonths: {
      type: Number,
      min: 0,
      max: 120,
      default: DEFAULT_OWNERSHIP_PERIOD_MONTHS,
    },
    duplicateNotificationDays: {
      type: Number,
      min: 0,
      max: 365,
      default: DEFAULT_DUPLICATE_NOTIFICATION_DAYS,
    },
    replacementPeriodDays: {
      type: Number,
      min: 0,
      max: 730,
      default: DEFAULT_REPLACEMENT_PERIOD_DAYS,
    },
    status: {
      type: String,
      enum: AGREEMENT_STATUSES,
      default: "DRAFT",
      index: true,
    },
    signedDocument: {
      type: signedDocumentSchema,
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

clientAgreementSchema.index({ organizationId: 1, agreementNumber: 1 }, { unique: true })
clientAgreementSchema.index({ organizationId: 1, clientId: 1, createdAt: -1 })
clientAgreementSchema.index({ organizationId: 1, status: 1, createdAt: -1 })
clientAgreementSchema.index({ organizationId: 1, expiryDate: 1 })

export const ClientAgreementModel = mongoose.model("ClientAgreement", clientAgreementSchema)
