const mongoose = require('mongoose');

const addonSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    kind: { type: String, enum: ['included', 'additional'], default: 'additional' },
    priceLabel: { type: String, trim: true, maxlength: 80, default: '' },
    amountInPaise: { type: Number, default: null }
  },
  { _id: false }
);

const planSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
    slug: { type: String, trim: true, maxlength: 120 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    tier: { type: String, enum: ['basic', 'pro'], default: 'basic' },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    price: { type: String, trim: true, maxlength: 40, default: '' },
    period: { type: String, trim: true, maxlength: 40, default: '/month' },
    amountInPaise: { type: Number, default: null },
    blurb: { type: String, trim: true, maxlength: 500, default: '' },
    cta: { type: String, trim: true, maxlength: 80, default: 'Get started' },
    highlighted: { type: Boolean, default: false },
    features: { type: [String], default: [] },
    addons: { type: [addonSchema], default: [] },
    freeTrialEnabled: { type: Boolean, default: true },
    freeTrialDays: { type: Number, default: 14 },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 }
  },
  { timestamps: true, id: false }
);

planSchema.index({ active: 1, sortOrder: 1 });
planSchema.index({ slug: 1 }, { unique: true, sparse: true });

function toPublicAddon(addon) {
  return {
    id: addon.id,
    name: addon.name,
    description: addon.description || '',
    kind: addon.kind === 'included' ? 'included' : 'additional',
    priceLabel: addon.priceLabel || '',
    amountInPaise: addon.amountInPaise ?? null
  };
}

function toPublic(doc) {
  const id = doc.id || doc.slug;
  const price = doc.price || '';
  const period = doc.period || '/month';
  const active = doc.active !== false;
  const freeTrialDays = typeof doc.freeTrialDays === 'number' ? doc.freeTrialDays : 14;
  return {
    id,
    slug: doc.slug || id,
    name: doc.name,
    tier: doc.tier,
    billingCycle: doc.billingCycle,
    price,
    period,
    priceLabel: price,
    periodLabel: period,
    amountInPaise: doc.amountInPaise ?? null,
    blurb: doc.blurb || '',
    cta: doc.cta || 'Get started',
    highlighted: Boolean(doc.highlighted),
    features: Array.isArray(doc.features) ? doc.features : [],
    addons: Array.isArray(doc.addons) ? doc.addons.map(toPublicAddon) : [],
    freeTrialEnabled: doc.freeTrialEnabled !== false,
    freeTrialDays,
    trialDays: freeTrialDays,
    active,
    isActive: active,
    sortOrder: typeof doc.sortOrder === 'number' ? doc.sortOrder : 0,
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : null
  };
}

planSchema.statics.toPublic = toPublic;

module.exports = mongoose.models.Plan || mongoose.model('Plan', planSchema);
