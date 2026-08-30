const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfTenant', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    mobile: { type: String, required: true, trim: true, maxlength: 20 },
    mobileNormalized: { type: String, required: true, trim: true, maxlength: 20, index: true },
    alternateMobile: { type: String, trim: true, maxlength: 20, default: '' },
    whatsapp: { type: String, trim: true, maxlength: 20, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
    city: { type: String, default: '' },
    district: { type: String, default: '' },
    state: { type: String, default: '' },
    pin: { type: String, default: '' },
    consent: {
      source: { type: String, default: '' },
      text: { type: String, default: '' },
      version: { type: String, default: '' },
      at: { type: Date, default: null },
      marketingOptIn: { type: Boolean, default: false }
    },
    identityKeys: { type: [String], default: [] },
    anonymized: { type: Boolean, default: false }
  },
  { timestamps: true, collection: 'zf_customers' }
);

customerSchema.index({ tenantId: 1, mobileNormalized: 1 });
customerSchema.index({ tenantId: 1, email: 1 });

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    tenant_id: doc.tenantId.toString(),
    name: doc.name,
    mobile: doc.mobile,
    mobile_normalized: doc.mobileNormalized,
    alternate_mobile: doc.alternateMobile || '',
    whatsapp: doc.whatsapp || '',
    email: doc.email || '',
    city: doc.city || '',
    district: doc.district || '',
    state: doc.state || '',
    pin: doc.pin || '',
    consent: doc.consent,
    anonymized: doc.anonymized,
    created_at: doc.createdAt.toISOString(),
    updated_at: doc.updatedAt.toISOString()
  };
}

customerSchema.statics.toPublic = toPublic;

module.exports = mongoose.models.ZfCustomer || mongoose.model('ZfCustomer', customerSchema);
