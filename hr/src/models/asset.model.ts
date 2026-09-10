import mongoose, { Schema } from "mongoose"

import { ASSET_CATEGORIES, ASSET_CONDITIONS, ASSET_STATUSES } from "../constants/assets.js"

const assetSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    assetCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    category: {
      type: String,
      enum: ASSET_CATEGORIES,
      required: true,
      index: true,
    },
    serialNumber: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    purchaseDate: {
      type: Date,
      default: null,
    },
    condition: {
      type: String,
      enum: ASSET_CONDITIONS,
      default: "good",
    },
    status: {
      type: String,
      enum: ASSET_STATUSES,
      default: "available",
      index: true,
    },
  },
  { timestamps: true }
)

assetSchema.index({ organizationId: 1, assetCode: 1 }, { unique: true })
assetSchema.index(
  { organizationId: 1, serialNumber: 1 },
  { unique: true, partialFilterExpression: { serialNumber: { $type: "string", $gt: "" } } }
)
assetSchema.index({ organizationId: 1, name: 1 })

export const AssetModel = mongoose.model("Asset", assetSchema)
