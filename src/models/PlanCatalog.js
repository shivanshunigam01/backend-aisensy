const mongoose = require('mongoose');
const { TRIAL_DEFAULTS } = require('../constants/planDefaults');

const trialSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    days: { type: Number, default: 14 },
    title: { type: String, trim: true, maxlength: 200, default: TRIAL_DEFAULTS.title },
    blurb: { type: String, trim: true, maxlength: 1000, default: TRIAL_DEFAULTS.blurb },
    cta: { type: String, trim: true, maxlength: 80, default: TRIAL_DEFAULTS.cta },
    features: { type: [String], default: () => [...TRIAL_DEFAULTS.features] }
  },
  { _id: false }
);

const planCatalogSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'main' },
    trial: { type: trialSchema, default: () => ({ ...TRIAL_DEFAULTS }) }
  },
  { timestamps: true }
);

function trialToPublic(trial) {
  const t = trial || {};
  return {
    enabled: t.enabled !== false,
    days: typeof t.days === 'number' && t.days > 0 ? t.days : 14,
    title: t.title || TRIAL_DEFAULTS.title,
    blurb: t.blurb || '',
    cta: t.cta || TRIAL_DEFAULTS.cta,
    features: Array.isArray(t.features) ? t.features : []
  };
}

function toPublic(doc, plans) {
  return {
    trial: trialToPublic(doc?.trial),
    plans: Array.isArray(plans) ? plans : [],
    updatedAt: doc?.updatedAt ? doc.updatedAt.toISOString() : null
  };
}

planCatalogSchema.statics.trialToPublic = trialToPublic;
planCatalogSchema.statics.toPublic = toPublic;

module.exports = mongoose.models.PlanCatalog || mongoose.model('PlanCatalog', planCatalogSchema);
