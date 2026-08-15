const mongoose = require('mongoose');

const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'];

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    email: { type: String, trim: true, maxlength: 254, default: '' },
    city: { type: String, trim: true, maxlength: 120, default: null },
    business_type: { type: String, trim: true, maxlength: 120, default: null },
    product_interest: { type: String, trim: true, maxlength: 200, default: null },
    message: { type: String, trim: true, maxlength: 8000, default: null },
    form_type: { type: String, trim: true, maxlength: 64, default: null },
    audit_type: { type: String, trim: true, maxlength: 64, default: null },
    calculator_type: { type: String, trim: true, maxlength: 64, default: null },
    company_name: { type: String, trim: true, maxlength: 200, default: null },
    tool_id: { type: String, trim: true, maxlength: 64, default: null },
    score: { type: Number, default: null },
    report_summary: { type: String, trim: true, maxlength: 2000, default: null },
    report_data: { type: String, default: null },
    source: { type: String, trim: true, maxlength: 64, default: 'website' },
    status: { type: String, enum: LEAD_STATUSES, default: 'new' },
    admin_notes: { type: String, trim: true, maxlength: 4000, default: null },
    bajaj_asd_application_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BajajAsdApplication',
      default: null
    }
  },
  { timestamps: true }
);

leadSchema.index({ phone: 1, source: 1 });
leadSchema.index({ form_type: 1, createdAt: -1 });

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    phone: doc.phone,
    email: doc.email || '',
    city: doc.city ?? null,
    business_type: doc.business_type ?? null,
    product_interest: doc.product_interest ?? null,
    message: doc.message ?? null,
    form_type: doc.form_type ?? null,
    audit_type: doc.audit_type ?? null,
    calculator_type: doc.calculator_type ?? null,
    company_name: doc.company_name ?? null,
    tool_id: doc.tool_id ?? null,
    score: doc.score ?? null,
    report_summary: doc.report_summary ?? null,
    report_data: doc.report_data ?? null,
    source: doc.source ?? null,
    status: doc.status,
    admin_notes: doc.admin_notes ?? null,
    created_at: doc.createdAt.toISOString(),
    updated_at: doc.updatedAt.toISOString()
  };
}

leadSchema.statics.toPublic = toPublic;

module.exports = mongoose.models.Lead || mongoose.model('Lead', leadSchema);
