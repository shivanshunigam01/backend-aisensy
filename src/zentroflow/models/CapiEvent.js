const mongoose = require('mongoose');
const { CAPI_EVENT_STATUSES } = require('../constants');

const capiEventSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfTenant', required: true, index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfLead', required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfCustomer', default: null },
    eventName: { type: String, required: true },
    eventTime: { type: Date, required: true },
    payloadHash: { type: String, required: true, index: true },
    status: { type: String, enum: CAPI_EVENT_STATUSES, default: 'queued', index: true },
    attempts: { type: Number, default: 0 },
    providerResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    lastError: { type: String, default: '' },
    idempotencyKey: { type: String, required: true }
  },
  { timestamps: true, collection: 'zf_capi_events' }
);

capiEventSchema.index({ tenantId: 1, idempotencyKey: 1 }, { unique: true });

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    tenant_id: doc.tenantId.toString(),
    lead_id: doc.leadId.toString(),
    customer_id: doc.customerId ? doc.customerId.toString() : null,
    event_name: doc.eventName,
    event_time: doc.eventTime.toISOString(),
    payload_hash: doc.payloadHash,
    status: doc.status,
    attempts: doc.attempts,
    provider_response: doc.providerResponse,
    last_error: doc.lastError || '',
    created_at: doc.createdAt.toISOString(),
    updated_at: doc.updatedAt.toISOString()
  };
}

capiEventSchema.statics.toPublic = toPublic;

module.exports = mongoose.models.ZfCapiEvent || mongoose.model('ZfCapiEvent', capiEventSchema);
