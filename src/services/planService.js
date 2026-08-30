const crypto = require('crypto');
const Plan = require('../models/Plan');
const PlanCatalog = require('../models/PlanCatalog');
const User = require('../models/User');
const { PLAN_DEFAULTS, TRIAL_DEFAULTS } = require('../constants/planDefaults');
const { normalizeEmail } = require('./authService');

function periodForCycle(cycle) {
  return cycle === 'yearly' ? '/year' : '/month';
}

function formatInrFromPaise(paise) {
  if (paise == null) return 'Custom';
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
}

function normalizeAddon(item, planId, index) {
  if (!item || typeof item !== 'object') return null;
  const name = typeof item.name === 'string' ? item.name.trim() : '';
  if (!name) return null;
  return {
    id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `addon-${planId}-${index}`,
    name,
    description: typeof item.description === 'string' ? item.description : '',
    kind: item.kind === 'included' ? 'included' : 'additional',
    priceLabel: typeof item.priceLabel === 'string' ? item.priceLabel : '',
    amountInPaise:
      typeof item.amountInPaise === 'number' && Number.isFinite(item.amountInPaise) ? item.amountInPaise : null
  };
}

function normalizePlan(raw, { fallbackId } = {}) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const id =
    typeof p.id === 'string' && p.id.trim()
      ? p.id.trim()
      : typeof p.slug === 'string' && p.slug.trim()
        ? p.slug.trim()
        : fallbackId || crypto.randomUUID();
  const slug = typeof p.slug === 'string' && p.slug.trim() ? p.slug.trim() : id;

  const billingCycle = p.billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const tier = p.tier === 'pro' ? 'pro' : 'basic';
  const amountInPaise =
    typeof p.amountInPaise === 'number' && Number.isFinite(p.amountInPaise)
      ? p.amountInPaise
      : p.amountInPaise === null
        ? null
        : 0;

  const addons = Array.isArray(p.addons)
    ? p.addons.map((item, i) => normalizeAddon(item, id, i)).filter(Boolean)
    : [];

  const features = Array.isArray(p.features)
    ? p.features.flatMap((f) => {
        if (typeof f === 'string' && f.trim()) return [f.trim()];
        if (f && typeof f === 'object' && typeof f.label === 'string' && f.kind !== 'addon' && f.label.trim()) {
          return [f.label.trim()];
        }
        return [];
      })
    : Array.isArray(p.featureLabels)
      ? p.featureLabels.filter((f) => typeof f === 'string' && f.trim()).map((f) => f.trim())
      : [];

  const freeTrialDays =
    typeof p.freeTrialDays === 'number' && Number.isFinite(p.freeTrialDays) && p.freeTrialDays > 0
      ? Math.round(p.freeTrialDays)
      : typeof p.trialDays === 'number' && Number.isFinite(p.trialDays) && p.trialDays > 0
        ? Math.round(p.trialDays)
        : 14;

  const priceRaw = typeof p.price === 'string' && p.price.trim() ? p.price.trim() : typeof p.priceLabel === 'string' ? p.priceLabel.trim() : '';
  const periodRaw = typeof p.period === 'string' && p.period.trim() ? p.period.trim() : typeof p.periodLabel === 'string' ? p.periodLabel.trim() : '';
  const active = p.active !== false && p.isActive !== false;

  return {
    id,
    slug,
    name: typeof p.name === 'string' && p.name.trim() ? p.name.trim() : 'Plan',
    tier,
    billingCycle,
    price: priceRaw || formatInrFromPaise(amountInPaise),
    period: periodRaw || periodForCycle(billingCycle),
    amountInPaise,
    blurb: typeof p.blurb === 'string' ? p.blurb : '',
    cta: typeof p.cta === 'string' && p.cta.trim() ? p.cta.trim() : 'Get started',
    highlighted: Boolean(p.highlighted),
    features,
    addons,
    freeTrialEnabled: p.freeTrialEnabled !== false,
    freeTrialDays,
    active,
    sortOrder: typeof p.sortOrder === 'number' && Number.isFinite(p.sortOrder) ? p.sortOrder : 0
  };
}

function applyPlanFields(doc, payload) {
  doc.slug = payload.slug || payload.id;
  doc.name = payload.name;
  doc.tier = payload.tier;
  doc.billingCycle = payload.billingCycle;
  doc.price = payload.price;
  doc.period = payload.period;
  doc.amountInPaise = payload.amountInPaise;
  doc.blurb = payload.blurb;
  doc.cta = payload.cta;
  doc.highlighted = payload.highlighted;
  doc.features = payload.features;
  doc.addons = payload.addons;
  doc.freeTrialEnabled = payload.freeTrialEnabled;
  doc.freeTrialDays = payload.freeTrialDays;
  doc.active = payload.active;
  doc.sortOrder = payload.sortOrder;
}

function normalizeTrial(raw) {
  const t = raw && typeof raw === 'object' ? raw : {};
  const days =
    typeof t.days === 'number' && Number.isFinite(t.days) && t.days > 0 ? Math.round(t.days) : TRIAL_DEFAULTS.days;
  return {
    enabled: t.enabled !== false,
    days,
    title: typeof t.title === 'string' && t.title.trim() ? t.title.trim() : `${days}-day free trial`,
    blurb: typeof t.blurb === 'string' ? t.blurb : TRIAL_DEFAULTS.blurb,
    cta: typeof t.cta === 'string' && t.cta.trim() ? t.cta.trim() : TRIAL_DEFAULTS.cta,
    features: Array.isArray(t.features)
      ? t.features.filter((f) => typeof f === 'string' && f.trim()).map((f) => f.trim())
      : [...TRIAL_DEFAULTS.features]
  };
}

async function findPlanByIdOrSlug(idOrSlug) {
  const key = typeof idOrSlug === 'string' ? idOrSlug.trim() : '';
  if (!key) return null;
  const or = [{ id: key }, { slug: key }];
  if (/^[a-fA-F0-9]{24}$/.test(key)) or.push({ _id: key });
  return Plan.findOne({ $or: or });
}

async function getOrCreateCatalog() {
  let doc = await PlanCatalog.findOne({ key: 'main' });
  if (!doc) {
    doc = await PlanCatalog.create({ key: 'main', trial: { ...TRIAL_DEFAULTS } });
  }
  return doc;
}

async function seedPlansIfNeeded() {
  const count = await Plan.countDocuments();
  if (count === 0) {
    await Plan.insertMany(PLAN_DEFAULTS);
    console.log('[plans] Seeded default pricing plans');
  }
  await getOrCreateCatalog();
}

async function getCatalog({ includeInactive } = {}) {
  await seedPlansIfNeeded();
  const catalogDoc = await getOrCreateCatalog();
  const filter = includeInactive === false ? { active: true } : {};
  const docs = await Plan.find(filter).sort({ sortOrder: 1, id: 1 });
  const plans = docs.map(Plan.toPublic);
  const catalogUpdatedAt = catalogDoc.updatedAt ? catalogDoc.updatedAt.getTime() : 0;
  const latestPlan = docs.reduce((max, d) => {
    const t = d.updatedAt ? d.updatedAt.getTime() : 0;
    return t > max ? t : max;
  }, catalogUpdatedAt);
  return {
    trial: PlanCatalog.trialToPublic(catalogDoc.trial),
    plans,
    updatedAt: latestPlan ? new Date(latestPlan).toISOString() : null
  };
}

async function replaceCatalog(body) {
  if (!Array.isArray(body?.plans)) {
    return { ok: false, status: 400, error: 'plans must be an array.' };
  }

  const catalogDoc = await getOrCreateCatalog();
  if (body.trial && typeof body.trial === 'object') {
    catalogDoc.trial = normalizeTrial(body.trial);
    await catalogDoc.save();
  }

  const payloads = body.plans.map((p, i) => {
    const plan = normalizePlan(p);
    if (!plan.sortOrder) plan.sortOrder = i + 1;
    return plan;
  });
  const ids = payloads.map((p) => p.id);

  if (payloads.length) {
    await Plan.bulkWrite(
      payloads.map((payload) => ({
        updateOne: {
          filter: { id: payload.id },
          update: { $set: payload },
          upsert: true
        }
      }))
    );
    await Plan.deleteMany({ id: { $nin: ids } });
  } else {
    await Plan.deleteMany({});
  }

  const catalog = await getCatalog();
  return { ok: true, catalog };
}

async function saveTrial(body) {
  const catalogDoc = await getOrCreateCatalog();
  catalogDoc.trial = normalizeTrial(body);
  await catalogDoc.save();
  return PlanCatalog.trialToPublic(catalogDoc.trial);
}

async function listPlans({ includeInactive }) {
  const catalog = await getCatalog({ includeInactive: Boolean(includeInactive) });
  return catalog.plans;
}

async function upsertPlan(body) {
  const payload = normalizePlan(body);
  const existing = await findPlanByIdOrSlug(payload.id);
  if (existing) {
    applyPlanFields(existing, payload);
    await existing.save();
    return { created: false, plan: Plan.toPublic(existing) };
  }
  const created = await Plan.create(payload);
  return { created: true, plan: Plan.toPublic(created) };
}

async function getPlan(id) {
  const existing = await findPlanByIdOrSlug(id);
  return existing ? Plan.toPublic(existing) : null;
}

async function replacePlan(id, body) {
  const existing = await findPlanByIdOrSlug(id);
  if (!existing) return null;
  const payload = normalizePlan(body, { fallbackId: existing.id });
  payload.id = existing.id;
  applyPlanFields(existing, payload);
  await existing.save();
  return Plan.toPublic(existing);
}

async function deletePlan(id) {
  const existing = await findPlanByIdOrSlug(id);
  if (!existing) return null;
  await Plan.deleteOne({ _id: existing._id });
  return existing.id;
}

function isTrialAvailable(plan) {
  return Boolean(plan && plan.active !== false && plan.freeTrialEnabled !== false);
}

async function startTrial(body) {
  const catalogDoc = await getOrCreateCatalog();
  const trial = PlanCatalog.trialToPublic(catalogDoc.trial);
  if (!trial.enabled) {
    return { ok: false, status: 400, error: 'Trial is not available for this plan.' };
  }

  const planKey =
    (typeof body.planSlug === 'string' && body.planSlug.trim()) ||
    (typeof body.planId === 'string' && body.planId.trim()) ||
    'basic-monthly';
  const plan = await findPlanByIdOrSlug(planKey);
  if (!isTrialAvailable(plan)) {
    return { ok: false, status: 400, error: 'Trial is not available for this plan.' };
  }

  const days = trial.days > 0 ? trial.days : plan.freeTrialDays > 0 ? plan.freeTrialDays : 14;
  const startsAt = new Date();
  const trialEndsAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);
  const normalized = normalizeEmail(body.email);

  if (normalized) {
    const user = await User.findOne({ email: normalized });
    if (user) {
      if (user.trialEndsAt || user.subscriptionStatus === 'trial' || user.subscriptionPlan === 'free-trial') {
        return { ok: false, status: 400, error: 'A free trial has already been used for this account.' };
      }
      user.subscriptionPlan = 'free-trial';
      user.subscriptionStatus = 'trial';
      user.trialEndsAt = trialEndsAt;
      await user.save();
    }
  }

  const endsAt = trialEndsAt.toISOString();
  return {
    ok: true,
    trialEndsAt: endsAt,
    trial: {
      planSlug: plan.slug || plan.id,
      days,
      startsAt: startsAt.toISOString(),
      endsAt
    }
  };
}

async function getBillablePlan(planId) {
  const plan = await findPlanByIdOrSlug(planId);
  if (!plan || plan.active === false) return null;
  if (plan.amountInPaise == null || plan.amountInPaise === 0) return null;
  return plan;
}

module.exports = {
  seedPlansIfNeeded,
  getCatalog,
  replaceCatalog,
  saveTrial,
  listPlans,
  getPlan,
  upsertPlan,
  replacePlan,
  deletePlan,
  startTrial,
  getBillablePlan
};
