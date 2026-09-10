import mongoose, { Schema } from "mongoose"

import { NOTIFICATION_TYPES } from "../constants/notifications.js"

const notificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 400,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
      index: true,
    },
    link: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
)

notificationSchema.index({ userId: 1, createdAt: -1 })
notificationSchema.index({ organizationId: 1, userId: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 })
notificationSchema.index(
  { userId: 1, "metadata.dedupeKey": 1 },
  {
    unique: true,
    partialFilterExpression: { "metadata.dedupeKey": { $type: "string", $gt: "" } },
  }
)

export const NotificationModel = mongoose.model("Notification", notificationSchema)
