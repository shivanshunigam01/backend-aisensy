const mongoose = require('mongoose');

const receiptSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, trim: true, unique: true },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: String, required: true },
    mode: { type: String, enum: ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'], default: 'Bank Transfer' }
  },
  { timestamps: true }
);

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    number: doc.number,
    invoiceId: doc.invoiceId.toString(),
    customerId: doc.customerId.toString(),
    amount: doc.amount,
    date: doc.date,
    mode: doc.mode
  };
}

receiptSchema.statics.toPublic = toPublic;
module.exports = mongoose.models.Receipt || mongoose.model('Receipt', receiptSchema);
