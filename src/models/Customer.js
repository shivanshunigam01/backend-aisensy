const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    description: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    company: { type: String, trim: true, maxlength: 200, default: '' },
    gstin: { type: String, trim: true, maxlength: 20, default: '' },
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    email: { type: String, trim: true, maxlength: 254, default: '' },
    city: { type: String, trim: true, maxlength: 120, default: '' },
    address: { type: String, trim: true, maxlength: 500, default: '' },
    totalSpend: { type: Number, default: 0 }
  },
  { timestamps: true }
);

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    company: doc.company || '',
    gstin: doc.gstin || '',
    phone: doc.phone || '',
    email: doc.email || '',
    city: doc.city || '',
    address: doc.address || '',
    totalSpend: doc.totalSpend || 0,
    createdAt: doc.createdAt.toISOString().slice(0, 10)
  };
}

customerSchema.statics.toPublic = toPublic;
module.exports = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
module.exports.lineItemSchema = lineItemSchema;
