const mongoose = require('mongoose');

const hyOfferCustomerSchema = new mongoose.Schema(
  {
    externalId: { type: String, trim: true, maxlength: 64, default: '' },
    branch: { type: String, required: true, trim: true, maxlength: 32 },
    customerName: { type: String, required: true, trim: true, maxlength: 120 },
    mobileNo: { type: String, required: true, trim: true, maxlength: 20 },
    dealerName: { type: String, trim: true, maxlength: 120, default: '' },
    referralCode: { type: String, required: true, trim: true, maxlength: 64 },
    referralLink: { type: String, trim: true, maxlength: 256, default: '' },
    deliveryStatus: { type: String, default: 'pending' },
    linkClicked: { type: Boolean, default: false },
    formSubmitted: { type: Boolean, default: false },
    clickedAt: { type: String, default: '' },
    submittedAt: { type: String, default: '' }
  },
  { timestamps: true }
);

hyOfferCustomerSchema.index({ referralCode: 1 }, { unique: true });
hyOfferCustomerSchema.index({ branch: 1 });

function toPublic(doc) {
  return {
    id: doc.externalId || doc._id.toString(),
    customerName: doc.customerName,
    mobileNo: doc.mobileNo,
    dealerName: doc.dealerName || '',
    referralCode: doc.referralCode,
    referralLink: doc.referralLink || '',
    deliveryStatus: doc.deliveryStatus || 'pending',
    linkClicked: doc.linkClicked,
    formSubmitted: doc.formSubmitted,
    clickedAt: doc.clickedAt || undefined,
    submittedAt: doc.submittedAt || undefined
  };
}

hyOfferCustomerSchema.statics.toPublic = toPublic;
module.exports = mongoose.models.HyOfferCustomer || mongoose.model('HyOfferCustomer', hyOfferCustomerSchema);
