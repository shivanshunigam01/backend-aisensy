const mongoose = require('mongoose');
const { lineItemSchema } = require('./Customer');

const DOC_STATUSES = ['draft', 'sent', 'paid', 'overdue', 'accepted', 'expired'];

const quotationSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, trim: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    date: { type: String, required: true },
    dueDate: { type: String, default: '' },
    items: { type: [lineItemSchema], default: [] },
    gstPercent: { type: Number, default: 18 },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    status: { type: String, enum: DOC_STATUSES, default: 'draft' }
  },
  { timestamps: true }
);

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    number: doc.number,
    customerId: doc.customerId.toString(),
    date: doc.date,
    dueDate: doc.dueDate || '',
    items: doc.items || [],
    gstPercent: doc.gstPercent ?? 18,
    notes: doc.notes || '',
    status: doc.status
  };
}

quotationSchema.statics.toPublic = toPublic;
module.exports = mongoose.models.Quotation || mongoose.model('Quotation', quotationSchema);
module.exports.DOC_STATUSES = DOC_STATUSES;
