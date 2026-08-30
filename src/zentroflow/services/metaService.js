const { env } = require('../../config/env');
const { Integration, Tenant } = require('../models');
const { enqueueJob } = require('./jobService');
const { ingestLead } = require('./ingestService');

/**
 * Meta Lead Ads adapter (SRS §6).
 * When META_* env keys are missing, webhook verify still works with configured
 * verify tokens per integration; retrieval becomes a queued stub/job.
 */

function isMetaConfigured() {
  return Boolean(env.metaAppId && env.metaAppSecret && (env.metaAccessToken || env.metaSystemUserToken));
}

function getMetaAccessToken(integration) {
  return (
    env.metaAccessToken ||
    env.metaSystemUserToken ||
    integration?.meta?.accessTokenRef ||
    ''
  );
}

async function verifyWebhookChallenge({ mode, token, challenge }) {
  if (mode !== 'subscribe') return null;
  // Global verify token OR any tenant integration verify token
  if (env.metaWebhookVerifyToken && token === env.metaWebhookVerifyToken) {
    return challenge;
  }
  const match = await Integration.findOne({
    provider: 'meta',
    'meta.verifyToken': token,
    status: 'active'
  });
  if (match) return challenge;
  return null;
}

async function handleWebhookPayload(body, correlationId) {
  const entries = body?.entry || [];
  const enqueued = [];

  for (const entry of entries) {
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field !== 'leadgen') continue;
      const value = change.value || {};
      const leadgenId = value.leadgen_id;
      const pageId = value.page_id;
      const formId = value.form_id;
      const adId = value.ad_id;
      const adsetId = value.adgroup_id || value.adset_id;
      const createdTime = value.created_time;

      if (!leadgenId) continue;

      const integration = await Integration.findOne({
        provider: 'meta',
        status: 'active',
        $or: [{ 'meta.pageId': String(pageId || '') }, { 'meta.formId': String(formId || '') }]
      });

      const tenantId = integration?.tenantId || null;

      const job = await enqueueJob({
        tenantId,
        type: 'meta_lead_retrieve',
        payload: {
          leadgen_id: leadgenId,
          page_id: pageId,
          form_id: formId,
          ad_id: adId,
          adset_id: adsetId,
          created_time: createdTime,
          integration_id: integration?._id?.toString() || null
        },
        correlationId,
        idempotencyKey: `meta:leadgen:${leadgenId}`
      });
      enqueued.push(job._id.toString());
    }
  }

  return { enqueued };
}

async function retrieveAndIngestMetaLead(job) {
  const { leadgen_id, page_id, form_id, ad_id, adset_id, created_time, integration_id } = job.payload || {};
  let integration = null;
  if (integration_id) integration = await Integration.findById(integration_id);

  if (!integration?.tenantId) {
    // Try map by page/form again
    integration = await Integration.findOne({
      provider: 'meta',
      $or: [{ 'meta.pageId': String(page_id || '') }, { 'meta.formId': String(form_id || '') }]
    });
  }

  if (!integration?.tenantId) {
    throw new Error('No Meta integration mapping for this page/form (configure META asset mapping)');
  }

  const tenant = await Tenant.findById(integration.tenantId);
  if (!tenant) throw new Error('Tenant missing for Meta integration');

  const token = getMetaAccessToken(integration);
  let fieldData = [];
  let metaLead = null;

  if (token && isMetaConfigured()) {
    const url = `https://graph.facebook.com/${env.metaGraphVersion || 'v21.0'}/${leadgen_id}?access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      integration.health = 'broken';
      integration.lastError = text.slice(0, 500);
      integration.lastErrorAt = new Date();
      await integration.save();
      throw new Error(`Meta lead retrieve failed: ${res.status} ${text.slice(0, 200)}`);
    }
    metaLead = await res.json();
    fieldData = metaLead.field_data || [];
    integration.health = 'healthy';
    integration.lastSuccessAt = new Date();
    integration.lastError = '';
    await integration.save();
  } else {
    // Dev / pre-key mode: create placeholder from webhook ids so pipeline is testable
    fieldData = [
      { name: 'full_name', values: [`Meta Lead ${leadgen_id}`] },
      { name: 'phone_number', values: ['9999999999'] }
    ];
  }

  const map = {};
  for (const f of fieldData) {
    map[f.name] = Array.isArray(f.values) ? f.values[0] : f.values;
  }

  const result = await ingestLead(
    {
      tenant_id: tenant._id.toString(),
      source_channel: 'meta_instant_form',
      provider: 'meta',
      external_lead_id: String(leadgen_id),
      source_created_at: created_time ? new Date(Number(created_time) * 1000).toISOString() : undefined,
      customer: {
        name: map.full_name || map.name || 'Meta Lead',
        mobile: map.phone_number || map.phone || map.mobile || '',
        email: map.email || ''
      },
      interest: {
        product: map.product || map.vehicle || integration.meta?.formName || ''
      },
      attribution: {
        source_channel: 'meta_instant_form',
        source_platform: 'meta',
        campaign_id: metaLead?.campaign_id || '',
        adset_id: adset_id || metaLead?.adset_id || '',
        ad_id: ad_id || metaLead?.ad_id || '',
        form_id: form_id || integration.meta?.formId || '',
        form_name: integration.meta?.formName || '',
        page_id: page_id || integration.meta?.pageId || '',
        account_id: integration.meta?.adAccountId || ''
      },
      consent: { source: 'meta_instant_form', version: 'meta', at: new Date().toISOString() },
      raw_provider_reference: metaLead || job.payload
    },
    { actorLabel: 'meta_webhook', correlationId: job.correlationId }
  );

  return result;
}

module.exports = {
  isMetaConfigured,
  verifyWebhookChallenge,
  handleWebhookPayload,
  retrieveAndIngestMetaLead
};
