const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254
    },
    fullName: { type: String, required: true, trim: true, maxlength: 200 },
    phoneDialCode: { type: String, required: true, trim: true, maxlength: 16 },
    phoneNational: { type: String, required: true, trim: true, maxlength: 32 },
    companyName: { type: String, required: true, trim: true, maxlength: 200 },
    companyDescription: { type: String, required: true, trim: true, maxlength: 8000 },
    country: { type: String, required: true, trim: true, maxlength: 120 },
    state: { type: String, required: true, trim: true, maxlength: 120 },
    companySize: { type: String, required: true, trim: true, maxlength: 120 },
    industry: { type: String, required: true, trim: true, maxlength: 120 },
    websiteUrl: { type: String, required: true, trim: true, maxlength: 2048 },
    timezone: { type: String, required: true, trim: true, maxlength: 120 },
    picture: { type: String, trim: true, maxlength: 2048, default: '' },
    passwordHash: { type: String, default: null, select: false },
    authMethod: { type: String, required: true, enum: ['password', 'google', 'pending'] },
    subscriptionPlan: { type: String, trim: true, maxlength: 120, default: null },
    subscriptionStatus: { type: String, trim: true, maxlength: 32, default: null },
    trialEndsAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
