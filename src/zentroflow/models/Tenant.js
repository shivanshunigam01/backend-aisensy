const mongoose = require('mongoose');
const { TENANT_STATUSES, DEFAULT_STAGES, DEFAULT_SCORE_RULES } = require('../constants');

const tenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    key: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 64 },
    status: { type: String, enum: TENANT_STATUSES, default: 'onboarding' },
    plan: { type: String, trim: true, maxlength: 64, default: 'standard' },
    timezone: { type: String, default: 'Asia/Kolkata' },
    retentionDays: { type: Number, default: 730 },
    duplicateWindowDays: { type: Number, default: 30 },
    stages: {
      type: [
        {
          key: String,
          label: String,
          order: Number,
          active: { type: Boolean, default: true }
        }
      ],
      default: () => DEFAULT_STAGES
    },
    scoreRules: { type: [mongoose.Schema.Types.Mixed], default: () => DEFAULT_SCORE_RULES },
    entitlements: {
      meta: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: false },
      email: { type: Boolean, default: true },
      voice: { type: Boolean, default: false },
      capi: { type: Boolean, default: false },
      analytics: { type: Boolean, default: true },
      automation: { type: Boolean, default: true }
    },
    contact: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' }
    },
    notes: { type: String, maxlength: 4000, default: '' }
  },
  { timestamps: true, collection: 'zf_tenants' }
);

tenantSchema.index({ status: 1 });

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    key: doc.key,
    status: doc.status,
    plan: doc.plan,
    timezone: doc.timezone,
    retention_days: doc.retentionDays,
    duplicate_window_days: doc.duplicateWindowDays,
    stages: doc.stages,
    score_rules: doc.scoreRules,
    entitlements: doc.entitlements,
    contact: doc.contact,
    notes: doc.notes,
    created_at: doc.createdAt.toISOString(),
    updated_at: doc.updatedAt.toISOString()
  };
}

tenantSchema.statics.toPublic = toPublic;

module.exports = mongoose.models.ZfTenant || mongoose.model('ZfTenant', tenantSchema);
