const crypto = require('crypto');
const { Customer, Lead, Activity, Tenant } = require('../models');
const { normalizeMobile, temperatureFromScore } = require('../utils/helpers');
const { writeAudit } = require('./auditService');
const { enqueueJob } = require('./jobService');
const { applyScoreRules } = require('./scoringService');
const { routeLead } = require('./routingService');

async function findOrCreateCustomer(tenantId, customerInput, consent) {
  const mobileNormalized = normalizeMobile(customerInput.mobile || customerInput.phone);
  if (!mobileNormalized) {
    const err = new Error('Customer mobile is required');
    err.code = 'VALIDATION';
    throw err;
  }

  let customer = await Customer.findOne({ tenantId, mobileNormalized });
  if (!customer) {
    customer = await Customer.create({
      tenantId,
      name: customerInput.name || 'Unknown',
      mobile: customerInput.mobile || customerInput.phone || mobileNormalized,
      mobileNormalized,
      alternateMobile: customerInput.alternate_mobile || customerInput.alternateMobile || '',
      whatsapp: customerInput.whatsapp || '',
      email: customerInput.email || '',
      city: customerInput.city || customerInput.location?.city || '',
      district: customerInput.district || customerInput.location?.district || '',
      state: customerInput.state || customerInput.location?.state || '',
      pin: customerInput.pin || customerInput.location?.pin || '',
      consent: consent || {}
    });
  } else {
    // refresh soft fields if empty
    const patch = {};
    if (!customer.email && customerInput.email) patch.email = customerInput.email;
    if (!customer.city && (customerInput.city || customerInput.location?.city)) {
      patch.city = customerInput.city || customerInput.location.city;
    }
    if (Object.keys(patch).length) {
      Object.assign(customer, patch);
      await customer.save();
    }
  }
  return customer;
}

async function detectDuplicate(tenant, customerId, product) {
  const windowDays = tenant.duplicateWindowDays || 30;
  const since = new Date(Date.now() - windowDays * 86400000);
  const existing = await Lead.findOne({
    tenantId: tenant._id,
    customerId,
    deleted: false,
    'interest.product': product || { $exists: true },
    createdAt: { $gte: since },
    currentStage: { $nin: ['lost', 'sale', 'invalid'] }
  }).sort({ createdAt: -1 });
  return existing;
}

/**
 * Normalized lead ingestion (SRS §21.1)
 * POST body shape: tenant_key, source_channel, external_lead_id, customer, interest, attribution, consent
 */
async function ingestLead(payload, opts = {}) {
  const {
    tenant_key,
    tenant_id,
    source_channel = 'api',
    external_lead_id = '',
    provider = '',
    source_created_at,
    customer: customerInput = {},
    interest = {},
    attribution = {},
    consent = {},
    raw_provider_reference,
    idempotency_key
  } = payload;

  if (!tenant_key && !tenant_id) {
    const err = new Error('tenant_key or tenant_id is required');
    err.code = 'VALIDATION';
    throw err;
  }

  const tenant = tenant_id
    ? await Tenant.findById(tenant_id)
    : await Tenant.findOne({ key: String(tenant_key).toLowerCase() });

  if (!tenant || tenant.status === 'churned') {
    const err = new Error('Tenant not found or inactive');
    err.code = 'TENANT_NOT_FOUND';
    throw err;
  }

  const idempotencyKey =
    idempotency_key ||
    (external_lead_id ? `${provider || source_channel}:${external_lead_id}` : '') ||
    opts.idempotencyKey ||
    '';

  if (idempotencyKey) {
    const dup = await Lead.findOne({ tenantId: tenant._id, idempotencyKey });
    if (dup) {
      return { lead: Lead.toPublic(dup), created: false, duplicate: false, idempotent: true };
    }
  }

  if (external_lead_id && provider) {
    const existingExt = await Lead.findOne({
      tenantId: tenant._id,
      provider,
      externalLeadId: external_lead_id
    });
    if (existingExt) {
      return { lead: Lead.toPublic(existingExt), created: false, duplicate: false, idempotent: true };
    }
  }

  const customer = await findOrCreateCustomer(tenant._id, customerInput, consent);
  const product = interest.product || interest.product_interest || '';
  const prior = await detectDuplicate(tenant, customer._id, product);

  const attr = {
    sourceChannel: attribution.source_channel || source_channel || 'api',
    sourcePlatform: attribution.source_platform || attribution.platform || '',
    campaignId: attribution.campaign_id || '',
    campaignName: attribution.campaign_name || '',
    adsetId: attribution.adset_id || '',
    adsetName: attribution.adset_name || '',
    adId: attribution.ad_id || '',
    adName: attribution.ad_name || '',
    formId: attribution.form_id || '',
    formName: attribution.form_name || '',
    pageId: attribution.page_id || '',
    accountId: attribution.account_id || '',
    utmSource: attribution.utm_source || '',
    utmMedium: attribution.utm_medium || '',
    utmCampaign: attribution.utm_campaign || '',
    utmContent: attribution.utm_content || '',
    utmTerm: attribution.utm_term || '',
    landingUrl: attribution.landing_url || '',
    referrer: attribution.referrer || ''
  };

  let currentStage = 'new';
  let duplicateOfLeadId = null;
  let duplicateReason = '';
  let qualificationStatus = 'pending';

  if (prior) {
    currentStage = 'duplicate';
    duplicateOfLeadId = prior._id;
    duplicateReason = `Same mobile + product within ${tenant.duplicateWindowDays} days`;
    qualificationStatus = 'duplicate';
  }

  // basic validation
  const mobileNorm = normalizeMobile(customerInput.mobile || customerInput.phone);
  if (!mobileNorm || mobileNorm.length < 10) {
    currentStage = 'invalid';
    qualificationStatus = 'invalid';
  } else if (!prior) {
    currentStage = 'valid';
  }

  const scoreResult = applyScoreRules(tenant.scoreRules || [], {
    purchase_timeline: interest.purchase_timeline || interest.purchaseTimeline,
    stage: currentStage,
    verification_status: 'pending',
    bot_qualified: false
  });

  const lead = await Lead.create({
    tenantId: tenant._id,
    branchId: payload.branch_id || null,
    customerId: customer._id,
    externalLeadId: external_lead_id || '',
    provider: provider || (attr.sourceChannel === 'meta_instant_form' ? 'meta' : ''),
    idempotencyKey,
    name: customer.name,
    mobile: customer.mobile,
    alternateMobile: customer.alternateMobile,
    whatsapp: customer.whatsapp,
    email: customer.email,
    city: customer.city,
    district: customer.district,
    state: customer.state,
    pin: customer.pin,
    interest: {
      product,
      variant: interest.variant || '',
      buyerType: interest.buyer_type || interest.buyerType || '',
      purchaseTimeline: interest.purchase_timeline || interest.purchaseTimeline || '',
      financeRequired: interest.finance_required ?? interest.financeRequired ?? null,
      exchangeRequired: interest.exchange_required ?? interest.exchangeRequired ?? null
    },
    attribution: attr,
    currentStage,
    verificationStatus: 'pending',
    qualificationStatus,
    leadScore: scoreResult.score,
    scoreReasons: scoreResult.reasons,
    temperature: temperatureFromScore(scoreResult.score),
    duplicateOfLeadId,
    duplicateReason,
    consent: {
      source: consent.source || '',
      text: consent.text || '',
      version: consent.version || '',
      at: consent.at ? new Date(consent.at) : consent.source ? new Date() : null,
      marketingOptIn: Boolean(consent.marketing_opt_in || consent.marketingOptIn)
    },
    rawPayload: raw_provider_reference || payload,
    receivedAt: new Date(),
    sourceCreatedAt: source_created_at ? new Date(source_created_at) : null
  });

  await Activity.create({
    tenantId: tenant._id,
    leadId: lead._id,
    customerId: customer._id,
    type: 'lead_created',
    channel: attr.sourceChannel,
    actorLabel: opts.actorLabel || 'ingest',
    content: prior ? `Lead ingested as duplicate of ${prior._id}` : 'Lead ingested',
    metadata: { source_channel: attr.sourceChannel, external_lead_id }
  });

  if (prior) {
    await Activity.create({
      tenantId: tenant._id,
      leadId: prior._id,
      customerId: customer._id,
      type: 'system',
      channel: attr.sourceChannel,
      actorLabel: 'ingest',
      content: `Related enquiry received (new lead ${lead._id})`,
      metadata: { related_lead_id: lead._id.toString() }
    });
  }

  // Auto-route when not invalid/duplicate (configurable later)
  if (!['invalid', 'duplicate'].includes(currentStage)) {
    try {
      await routeLead(lead, { mode: 'rule', reason: 'auto_on_ingest' });
    } catch (e) {
      console.warn('[zentroflow] routing skipped', e.message);
    }
  }

  await writeAudit({
    tenantId: tenant._id,
    actorLabel: opts.actorLabel || 'ingest',
    action: 'lead.ingest',
    objectType: 'lead',
    objectId: lead._id.toString(),
    after: { stage: lead.currentStage, source: attr.sourceChannel },
    correlationId: opts.correlationId
  });

  // Notification hook
  await enqueueJob({
    tenantId: tenant._id,
    type: 'notification',
    payload: { event: 'lead.created', lead_id: lead._id.toString() },
    correlationId: opts.correlationId,
    idempotencyKey: `notify:lead.created:${lead._id}`
  });

  return {
    lead: Lead.toPublic(lead),
    created: true,
    duplicate: Boolean(prior),
    idempotent: false
  };
}

module.exports = { ingestLead, findOrCreateCustomer, detectDuplicate };
