import mongoose, { Schema } from "mongoose"

import { PAYMENT_METHODS, PAYMENT_STATUSES } from "../constants/payments.js"

const invoicePaymentSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      min: 0,
      required: true,
    },
    paymentDate: {
      type: Date,
      required: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
      default: "BANK_TRANSFER",
    },
    transactionReference: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      required: true,
      default: "COMPLETED",
      index: true,
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: 4000,
      default: "",
    },
  },
  { timestamps: true }
)

invoicePaymentSchema.index({ organizationId: 1, invoiceId: 1, paymentDate: -1 })
invoicePaymentSchema.index({ organizationId: 1, status: 1, paymentDate: -1 })

export const InvoicePaymentModel = mongoose.model("InvoicePayment", invoicePaymentSchema)
