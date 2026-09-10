import mongoose, { Schema } from "mongoose"

import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_PRIORITIES,
} from "../constants/announcements.js"
import { USER_ROLE_VALUES } from "../constants/roles.js"

const announcementSchema = new Schema(
  {
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
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 8000,
    },
    category: {
      type: String,
      enum: ANNOUNCEMENT_CATEGORIES,
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ANNOUNCEMENT_PRIORITIES,
      default: "normal",
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    publishDate: {
      type: Date,
      default: null,
      index: true,
    },
    expiryDate: {
      type: Date,
      default: null,
      index: true,
    },
    targetAudience: {
      type: [
        {
          type: String,
          enum: USER_ROLE_VALUES,
        },
      ],
      default: [],
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
)

announcementSchema.index({ organizationId: 1, isPublished: 1, publishDate: -1 })
announcementSchema.index({ organizationId: 1, category: 1, publishDate: -1 })
announcementSchema.index({ organizationId: 1, title: 1 })

export const AnnouncementModel = mongoose.model("Announcement", announcementSchema)
