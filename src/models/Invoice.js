const mongoose = require('mongoose');
const { lineItemSchema } = require('./Customer');
const { DOC_STATUSES } = require('./Quotation');

const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, trim: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    quotationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation', default: null },
    date: { type: String, required: true },
    dueDate: { type: String, default: '' },
    items: { type: [lineItemSchema], default: [] },
    gstPercent: { type: Number, default: 18 },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    status: { type: String, enum: DOC_STATUSES, default: 'draft' },
    paidAt: { type: String, default: '' }
  },
  { timestamps: true }
);

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    number: doc.number,
    customerId: doc.customerId.toString(),
    quotationId: doc.quotationId ? doc.quotationId.toString() : undefined,
    date: doc.date,
    dueDate: doc.dueDate || '',
    items: doc.items || [],
    gstPercent: doc.gstPercent ?? 18,
    notes: doc.notes || '',
    status: doc.status,
    paidAt: doc.paidAt || undefined
  };
}

invoiceSchema.statics.toPublic = toPublic;
module.exports = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
