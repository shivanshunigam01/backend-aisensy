const mongoose = require('mongoose');
const {
  LEAD_STAGES,
  VERIFICATION_STATUSES,
  QUALIFICATION_STATUSES,
  TEMPERATURES,
  SOURCE_CHANNELS
} = require('../constants');

const attributionSchema = new mongoose.Schema(
  {
    sourceChannel: { type: String, enum: SOURCE_CHANNELS, default: 'manual' },
    sourcePlatform: { type: String, default: '' },
    campaignId: { type: String, default: '' },
    campaignName: { type: String, default: '' },
    adsetId: { type: String, default: '' },
    adsetName: { type: String, default: '' },
    adId: { type: String, default: '' },
    adName: { type: String, default: '' },
    formId: { type: String, default: '' },
    formName: { type: String, default: '' },
    pageId: { type: String, default: '' },
    accountId: { type: String, default: '' },
    utmSource: { type: String, default: '' },
    utmMedium: { type: String, default: '' },
    utmCampaign: { type: String, default: '' },
    utmContent: { type: String, default: '' },
    utmTerm: { type: String, default: '' },
    landingUrl: { type: String, default: '' },
    referrer: { type: String, default: '' }
  },
  { _id: false }
);

const interestSchema = new mongoose.Schema(
  {
    product: { type: String, default: '' },
    variant: { type: String, default: '' },
    buyerType: { type: String, default: '' },
    purchaseTimeline: { type: String, default: '' },
    financeRequired: { type: Boolean, default: null },
    exchangeRequired: { type: Boolean, default: null }
  },
  { _id: false }
);

const leadSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfTenant', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfBranch', default: null, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfCustomer', required: true, index: true },
    externalLeadId: { type: String, default: '', index: true },
    provider: { type: String, default: '' },
    idempotencyKey: { type: String, default: '', index: true },

    // denormalized customer snapshot for list views
    name: { type: String, required: true, trim: true, maxlength: 200 },
    mobile: { type: String, required: true, trim: true, maxlength: 20 },
    alternateMobile: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    email: { type: String, default: '' },
    city: { type: String, default: '' },
    district: { type: String, default: '' },
    state: { type: String, default: '' },
    pin: { type: String, default: '' },

    interest: { type: interestSchema, default: () => ({}) },
    attribution: { type: attributionSchema, default: () => ({}) },

    currentStage: { type: String, enum: LEAD_STAGES, default: 'new', index: true },
    subStatus: { type: String, default: '' },
    verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'pending', index: true },
    qualificationStatus: { type: String, enum: QUALIFICATION_STATUSES, default: 'pending', index: true },
    leadScore: { type: Number, default: 0 },
    scoreReasons: { type: [String], default: [] },
    temperature: { type: String, enum: TEMPERATURES, default: 'cold', index: true },
    favorite: { type: Boolean, default: false },
    tags: { type: [String], default: [] },

    assignedTeam: { type: String, default: '' },
    assignedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfUser', default: null, index: true },
    assignmentAt: { type: Date, default: null },
    lastReassignmentAt: { type: Date, default: null },

    nextFollowupAt: { type: Date, default: null, index: true },
    lastContactAt: { type: Date, default: null },
    lastRemark: { type: String, default: '', maxlength: 2000 },
    overdue: { type: Boolean, default: false, index: true },

    outcome: {
      appointmentAt: { type: Date, default: null },
      testDriveAt: { type: Date, default: null },
      quotationRef: { type: String, default: '' },
      bookingRef: { type: String, default: '' },
      saleValue: { type: Number, default: null },
      saleDate: { type: Date, default: null },
      lostReason: { type: String, default: '' }
    },

    consent: {
      source: { type: String, default: '' },
      text: { type: String, default: '' },
      version: { type: String, default: '' },
      at: { type: Date, default: null },
      marketingOptIn: { type: Boolean, default: false }
    },

    duplicateOfLeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfLead', default: null },
    duplicateReason: { type: String, default: '' },
    rawPayload: { type: mongoose.Schema.Types.Mixed, default: null },
    receivedAt: { type: Date, default: Date.now },
    sourceCreatedAt: { type: Date, default: null },
    deleted: { type: Boolean, default: false },
    anonymized: { type: Boolean, default: false }
  },
  { timestamps: true, collection: 'zf_leads' }
);

leadSchema.index({ tenantId: 1, createdAt: -1 });
leadSchema.index({ tenantId: 1, currentStage: 1, createdAt: -1 });
leadSchema.index({ tenantId: 1, assignedUserId: 1, nextFollowupAt: 1 });
leadSchema.index({ tenantId: 1, 'attribution.campaignId': 1 });
leadSchema.index(
  { tenantId: 1, provider: 1, externalLeadId: 1 },
  { unique: true, partialFilterExpression: { externalLeadId: { $gt: '' } } }
);
leadSchema.index(
  { tenantId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $gt: '' } } }
);

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    tenant_id: doc.tenantId.toString(),
    branch_id: doc.branchId ? doc.branchId.toString() : null,
    customer_id: doc.customerId.toString(),
    external_lead_id: doc.externalLeadId || '',
    provider: doc.provider || '',
    name: doc.name,
    mobile: doc.mobile,
    alternate_mobile: doc.alternateMobile || '',
    whatsapp: doc.whatsapp || '',
    email: doc.email || '',
    city: doc.city || '',
    district: doc.district || '',
    state: doc.state || '',
    pin: doc.pin || '',
    interest: doc.interest,
    attribution: {
      source_channel: doc.attribution?.sourceChannel || 'manual',
      source_platform: doc.attribution?.sourcePlatform || '',
      campaign_id: doc.attribution?.campaignId || '',
      campaign_name: doc.attribution?.campaignName || '',
      adset_id: doc.attribution?.adsetId || '',
      adset_name: doc.attribution?.adsetName || '',
      ad_id: doc.attribution?.adId || '',
      ad_name: doc.attribution?.adName || '',
      form_id: doc.attribution?.formId || '',
      form_name: doc.attribution?.formName || '',
      page_id: doc.attribution?.pageId || '',
      account_id: doc.attribution?.accountId || '',
      utm_source: doc.attribution?.utmSource || '',
      utm_medium: doc.attribution?.utmMedium || '',
      utm_campaign: doc.attribution?.utmCampaign || '',
      utm_content: doc.attribution?.utmContent || '',
      utm_term: doc.attribution?.utmTerm || '',
      landing_url: doc.attribution?.landingUrl || '',
      referrer: doc.attribution?.referrer || ''
    },
    current_stage: doc.currentStage,
    sub_status: doc.subStatus || '',
    verification_status: doc.verificationStatus,
    qualification_status: doc.qualificationStatus,
    lead_score: doc.leadScore,
    score_reasons: doc.scoreReasons || [],
    temperature: doc.temperature,
    favorite: doc.favorite,
    tags: doc.tags || [],
    assigned_team: doc.assignedTeam || '',
    assigned_user_id: doc.assignedUserId ? doc.assignedUserId.toString() : null,
    assignment_at: doc.assignmentAt ? doc.assignmentAt.toISOString() : null,
    last_reassignment_at: doc.lastReassignmentAt ? doc.lastReassignmentAt.toISOString() : null,
    next_followup_at: doc.nextFollowupAt ? doc.nextFollowupAt.toISOString() : null,
    last_contact_at: doc.lastContactAt ? doc.lastContactAt.toISOString() : null,
    last_remark: doc.lastRemark || '',
    overdue: doc.overdue,
    outcome: {
      appointment_at: doc.outcome?.appointmentAt ? doc.outcome.appointmentAt.toISOString() : null,
      test_drive_at: doc.outcome?.testDriveAt ? doc.outcome.testDriveAt.toISOString() : null,
      quotation_ref: doc.outcome?.quotationRef || '',
      booking_ref: doc.outcome?.bookingRef || '',
      sale_value: doc.outcome?.saleValue ?? null,
      sale_date: doc.outcome?.saleDate ? doc.outcome.saleDate.toISOString() : null,
      lost_reason: doc.outcome?.lostReason || ''
    },
    consent: doc.consent,
    duplicate_of_lead_id: doc.duplicateOfLeadId ? doc.duplicateOfLeadId.toString() : null,
    duplicate_reason: doc.duplicateReason || '',
    received_at: doc.receivedAt ? doc.receivedAt.toISOString() : null,
    source_created_at: doc.sourceCreatedAt ? doc.sourceCreatedAt.toISOString() : null,
    created_at: doc.createdAt.toISOString(),
    updated_at: doc.updatedAt.toISOString()
  };
}

leadSchema.statics.toPublic = toPublic;

module.exports = mongoose.models.ZfLead || mongoose.model('ZfLead', leadSchema);
