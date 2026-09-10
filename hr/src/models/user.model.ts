import mongoose, { Schema } from "mongoose"

import { USER_ROLE_VALUES, USER_ROLES } from "../constants/roles.js"
import { hashPassword } from "../utils/password.js"

const userSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    employeeId: {
      type: String,
      trim: true,
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    profileImage: {
      type: String,
      trim: true,
      default: "",
    },
    password: {
      type: String,
      required: true,
      select: false,
      minlength: 8,
    },
    role: {
      type: String,
      enum: USER_ROLE_VALUES,
      required: true,
      default: USER_ROLES.EMPLOYEE,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    refreshTokenHash: {
      type: String,
      select: false,
      default: null,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
      default: null,
    },
  },
  { timestamps: true }
)

userSchema.index(
  { organizationId: 1, employeeId: 1 },
  {
    unique: true,
    partialFilterExpression: { employeeId: { $type: "string" } },
  }
)

userSchema.index(
  { passwordResetToken: 1 },
  {
    unique: true,
    partialFilterExpression: { passwordResetToken: { $type: "string" } },
  }
)

userSchema.pre("save", async function hashIfNeeded() {
  if (!this.isModified("password")) {
    return
  }

  this.password = await hashPassword(this.password)
})

export const UserModel = mongoose.model("User", userSchema)
