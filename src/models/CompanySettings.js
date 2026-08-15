const mongoose = require('mongoose');

const companySettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'main' },
    name: { type: String, default: '' },
    address: { type: String, default: '' },
    gstin: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    defaultGstPercent: { type: Number, default: 18 },
    bankDetails: { type: String, default: '' },
    footerNote: { type: String, default: '' },
    logoDataUrl: { type: String, default: '' }
  },
  { timestamps: true }
);

function toPublic(doc) {
  return {
    name: doc.name || '',
    address: doc.address || '',
    gstin: doc.gstin || '',
    phone: doc.phone || '',
    email: doc.email || '',
    defaultGstPercent: doc.defaultGstPercent ?? 18,
    bankDetails: doc.bankDetails || '',
    footerNote: doc.footerNote || '',
    logoDataUrl: doc.logoDataUrl || ''
  };
}

companySettingsSchema.statics.toPublic = toPublic;
module.exports = mongoose.models.CompanySettings || mongoose.model('CompanySettings', companySettingsSchema);
