const mongoose = require('mongoose');

const bajajAsdApplicationSchema = new mongoose.Schema(
  {
    state: { type: String, required: true, enum: ['Bihar', 'Jharkhand'] },
    districts: { type: [String], required: true, default: [] },
    locations: { type: [String], required: true, default: [] },
    target_location: { type: String, trim: true, maxlength: 500, default: '' },
    target_location_label: { type: String, trim: true, maxlength: 1000, default: '' },
    district: { type: String, trim: true, maxlength: 500, default: '' },
    applicant_name: { type: String, required: true, trim: true, maxlength: 80 },
    mobile: { type: String, required: true, trim: true, maxlength: 10 },
    alternate_mobile: { type: String, trim: true, maxlength: 10, default: '' },
    email: { type: String, trim: true, maxlength: 254, default: '' },
    current_town: { type: String, required: true, trim: true, maxlength: 100 },
    pan: { type: String, trim: true, maxlength: 10, default: '' },
    gst_number: { type: String, trim: true, maxlength: 15, default: '' },
    is_existing_business: { type: String, required: true, enum: ['Yes', 'No'] },
    business_name: { type: String, trim: true, maxlength: 120, default: '' },
    business_type: { type: String, required: true, trim: true, maxlength: 120 },
    other_business_type: { type: String, trim: true, maxlength: 100, default: '' },
    years_in_business: { type: String, trim: true, maxlength: 64, default: '' },
    existing_oem: { type: String, required: true, enum: ['Yes', 'No'] },
    oem_brand: { type: String, trim: true, maxlength: 100, default: '' },
    investment_capacity: { type: String, required: true, trim: true, maxlength: 64 },
    space_status: { type: String, required: true, trim: true, maxlength: 64 },
    showroom_space: { type: String, trim: true, maxlength: 64, default: '' },
    workshop_space: { type: String, trim: true, maxlength: 64, default: '' },
    space_size: { type: String, trim: true, maxlength: 128, default: '' },
    frontage: { type: String, trim: true, maxlength: 64, default: '' },
    start_timeline: { type: String, required: true, trim: true, maxlength: 64 },
    applicant_remarks: { type: String, trim: true, maxlength: 500, default: '' },
    contact_consent: { type: Boolean, required: true },
    disclaimer_ack: { type: Boolean, required: true },
    consent_policy_version: { type: String, required: true, trim: true, maxlength: 32 },
    consent_at: { type: Date, required: true },
    lead_score: { type: Number, required: true, default: 0 },
    lead_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'won', 'lost'],
      default: 'new'
    },
    admin_notes: { type: String, trim: true, maxlength: 4000, default: null }
  },
  { timestamps: true }
);

bajajAsdApplicationSchema.index({ mobile: 1, state: 1 }, { unique: true });

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    state: doc.state,
    districts: doc.districts ?? [],
    locations: doc.locations ?? [],
    target_location: doc.target_location || '',
    target_location_label: doc.target_location_label || '',
    district: doc.district || '',
    applicant_name: doc.applicant_name,
    mobile: doc.mobile,
    alternate_mobile: doc.alternate_mobile || '',
    email: doc.email || '',
    current_town: doc.current_town,
    pan: doc.pan || '',
    gst_number: doc.gst_number || '',
    is_existing_business: doc.is_existing_business,
    business_name: doc.business_name || '',
    business_type: doc.business_type,
    other_business_type: doc.other_business_type || '',
    years_in_business: doc.years_in_business || '',
    existing_oem: doc.existing_oem,
    oem_brand: doc.oem_brand || '',
    investment_capacity: doc.investment_capacity,
    space_status: doc.space_status,
    showroom_space: doc.showroom_space || '',
    workshop_space: doc.workshop_space || '',
    space_size: doc.space_size || '',
    frontage: doc.frontage || '',
    start_timeline: doc.start_timeline,
    applicant_remarks: doc.applicant_remarks || '',
    contact_consent: doc.contact_consent,
    disclaimer_ack: doc.disclaimer_ack,
    consent_policy_version: doc.consent_policy_version,
    consent_at: doc.consent_at.toISOString(),
    lead_score: doc.lead_score,
    lead_id: doc.lead_id ? doc.lead_id.toString() : null,
    status: doc.status,
    admin_notes: doc.admin_notes ?? null,
    submitted_at: doc.createdAt.toISOString(),
    created_at: doc.createdAt.toISOString(),
    updated_at: doc.updatedAt.toISOString()
  };
}

bajajAsdApplicationSchema.statics.toPublic = toPublic;

module.exports =
  mongoose.models.BajajAsdApplication ||
  mongoose.model('BajajAsdApplication', bajajAsdApplicationSchema);
