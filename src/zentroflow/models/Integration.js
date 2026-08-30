const mongoose = require('mongoose');
const { INTEGRATION_PROVIDERS, INTEGRATION_HEALTH } = require('../constants');

const integrationSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfTenant', required: true, index: true },
    provider: { type: String, enum: INTEGRATION_PROVIDERS, required: true },
    label: { type: String, default: '' },
    status: { type: String, enum: ['active', 'disabled', 'error'], default: 'active' },
    health: { type: String, enum: INTEGRATION_HEALTH, default: 'not_configured' },
    healthMessage: { type: String, default: '' },
    tokenExpiresAt: { type: Date, default: null },
    // Meta asset mapping (META-01)
    meta: {
      businessId: { type: String, default: '' },
      pageId: { type: String, default: '' },
      pageName: { type: String, default: '' },
      adAccountId: { type: String, default: '' },
      formId: { type: String, default: '' },
      formName: { type: String, default: '' },
      datasetId: { type: String, default: '' },
      verifyToken: { type: String, default: '' },
      accessTokenRef: { type: String, default: '' }
    },
    whatsapp: {
      provider: { type: String, default: '' },
      businessId: { type: String, default: '' },
      phoneNumberId: { type: String, default: '' }
    },
    email: {
      fromName: { type: String, default: '' },
      fromEmail: { type: String, default: '' },
      provider: { type: String, default: 'ses' }
    },
    voice: {
      provider: { type: String, default: '' },
      accountId: { type: String, default: '' }
    },
    capi: {
      datasetId: { type: String, default: '' },
      eventMap: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    permissions: { type: [String], default: [] },
    lastSuccessAt: { type: Date, default: null },
    lastErrorAt: { type: Date, default: null },
    lastError: { type: String, default: '' }
  },
  { timestamps: true, collection: 'zf_integrations' }
);

integrationSchema.index({ tenantId: 1, provider: 1 });

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    tenant_id: doc.tenantId.toString(),
    provider: doc.provider,
    label: doc.label || '',
    status: doc.status,
    health: doc.health,
    health_message: doc.healthMessage || '',
    token_expires_at: doc.tokenExpiresAt ? doc.tokenExpiresAt.toISOString() : null,
    meta: doc.meta,
    whatsapp: doc.whatsapp,
    email: doc.email,
    voice: doc.voice,
    capi: doc.capi,
    permissions: doc.permissions || [],
    last_success_at: doc.lastSuccessAt ? doc.lastSuccessAt.toISOString() : null,
    last_error_at: doc.lastErrorAt ? doc.lastErrorAt.toISOString() : null,
    last_error: doc.lastError || '',
    created_at: doc.createdAt.toISOString(),
    updated_at: doc.updatedAt.toISOString()
  };
}

integrationSchema.statics.toPublic = toPublic;

module.exports = mongoose.models.ZfIntegration || mongoose.model('ZfIntegration', integrationSchema);
