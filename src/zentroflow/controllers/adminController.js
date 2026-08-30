const { Tenant, Branch, User, Product, Integration, AutomationRule, AuditLog } = require('../models');
const authService = require('../services/authService');
const dashboardService = require('../services/dashboardService');
const { pagination, errorEnvelope, slugifyKey } = require('../utils/helpers');
const { writeAudit } = require('../services/auditService');

async function platformOverview(req, res, next) {
  try {
    const data = await dashboardService.getPlatformOverview();
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function listTenants(req, res, next) {
  try {
    const { page, limit, skip } = pagination(req.query);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.q) filter.name = new RegExp(String(req.query.q), 'i');
    const [items, total] = await Promise.all([
      Tenant.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Tenant.countDocuments(filter)
    ]);
    return res.json({ items: items.map(Tenant.toPublic), total, page, limit });
  } catch (err) {
    return next(err);
  }
}

async function createTenant(req, res, next) {
  try {
    const result = await authService.onboardTenant(req.body || {}, {
      id: req.zfUser.id,
      name: req.zfUser.name
    });
    return res.status(201).json(result);
  } catch (err) {
    if (err.code === 'CONFLICT') {
      return res.status(409).json(errorEnvelope('CONFLICT', err.message, req.correlationId));
    }
    return next(err);
  }
}

async function getTenant(req, res, next) {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json(errorEnvelope('NOT_FOUND', 'Tenant not found', req.correlationId));
    return res.json({ tenant: Tenant.toPublic(tenant) });
  } catch (err) {
    return next(err);
  }
}

async function updateTenant(req, res, next) {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) return res.status(404).json(errorEnvelope('NOT_FOUND', 'Tenant not found', req.correlationId));
    const before = Tenant.toPublic(tenant);
    const b = req.body || {};
    if (b.name) tenant.name = b.name;
    if (b.status) tenant.status = b.status;
    if (b.plan) tenant.plan = b.plan;
    if (b.timezone) tenant.timezone = b.timezone;
    if (b.duplicate_window_days != null) tenant.duplicateWindowDays = b.duplicate_window_days;
    if (b.stages) tenant.stages = b.stages;
    if (b.score_rules) tenant.scoreRules = b.score_rules;
    if (b.entitlements) tenant.entitlements = { ...tenant.entitlements, ...b.entitlements };
    if (b.contact) tenant.contact = { ...tenant.contact, ...b.contact };
    if (b.notes != null) tenant.notes = b.notes;
    await tenant.save();
    await writeAudit({
      tenantId: tenant._id,
      actorUserId: req.zfUser.id,
      actorLabel: req.zfUser.name,
      action: 'tenant.update',
      objectType: 'tenant',
      objectId: tenant._id.toString(),
      before,
      after: Tenant.toPublic(tenant),
      correlationId: req.correlationId
    });
    return res.json({ tenant: Tenant.toPublic(tenant) });
  } catch (err) {
    return next(err);
  }
}

async function listBranches(req, res, next) {
  try {
    const tenantId = req.tenantId;
    const items = await Branch.find({ tenantId }).sort({ name: 1 });
    return res.json({ items: items.map(Branch.toPublic) });
  } catch (err) {
    return next(err);
  }
}

async function createBranch(req, res, next) {
  try {
    const b = req.body || {};
    const branch = await Branch.create({
      tenantId: req.tenantId,
      branchCode: b.branch_code || slugifyKey(b.name),
      name: b.name,
      geography: b.geography || {},
      managerUserId: b.manager_user_id || null,
      active: b.active !== false
    });
    return res.status(201).json({ branch: Branch.toPublic(branch) });
  } catch (err) {
    return next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const filter = {};
    if (req.tenantId) filter.tenantId = req.tenantId;
    if (req.query.role) filter.role = req.query.role;
    const items = await User.find(filter).sort({ createdAt: -1 }).limit(500);
    return res.json({ items: items.map(User.toPublic) });
  } catch (err) {
    return next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const body = { ...(req.body || {}) };
    if (!body.tenant_id && req.tenantId) body.tenant_id = req.tenantId;
    const user = await authService.createUser(body, { id: req.zfUser.id, name: req.zfUser.name });
    return res.status(201).json({ user });
  } catch (err) {
    if (err.code === 'CONFLICT') {
      return res.status(409).json(errorEnvelope('CONFLICT', err.message, req.correlationId));
    }
    return next(err);
  }
}

async function listProducts(req, res, next) {
  try {
    const filter = {
      $or: [{ tenantId: req.tenantId }, { global: true }, { tenantId: null }]
    };
    const items = await Product.find(filter).sort({ name: 1 });
    return res.json({ items: items.map(Product.toPublic) });
  } catch (err) {
    return next(err);
  }
}

async function createProduct(req, res, next) {
  try {
    const b = req.body || {};
    const product = await Product.create({
      tenantId: req.tenantId || null,
      name: b.name,
      code: b.code || slugifyKey(b.name),
      variants: b.variants || [],
      active: b.active !== false,
      global: Boolean(b.global)
    });
    return res.status(201).json({ product: Product.toPublic(product) });
  } catch (err) {
    return next(err);
  }
}

async function listIntegrations(req, res, next) {
  try {
    const filter = {};
    if (req.tenantId) filter.tenantId = req.tenantId;
    if (req.query.provider) filter.provider = req.query.provider;
    const items = await Integration.find(filter).sort({ updatedAt: -1 });
    return res.json({ items: items.map(Integration.toPublic) });
  } catch (err) {
    return next(err);
  }
}

async function upsertIntegration(req, res, next) {
  try {
    const b = req.body || {};
    if (!b.provider) {
      return res.status(400).json(errorEnvelope('VALIDATION', 'provider required', req.correlationId));
    }
    let doc = null;
    if (b.id) doc = await Integration.findOne({ _id: b.id, tenantId: req.tenantId });
    if (!doc) {
      doc = await Integration.findOne({ tenantId: req.tenantId, provider: b.provider, label: b.label || '' });
    }
    if (!doc) {
      doc = new Integration({ tenantId: req.tenantId, provider: b.provider });
    }
    if (b.label != null) doc.label = b.label;
    if (b.status) doc.status = b.status;
    if (b.health) doc.health = b.health;
    if (b.meta) doc.meta = { ...doc.meta?.toObject?.() || doc.meta || {}, ...b.meta };
    if (b.whatsapp) doc.whatsapp = { ...doc.whatsapp?.toObject?.() || doc.whatsapp || {}, ...b.whatsapp };
    if (b.email) doc.email = { ...doc.email?.toObject?.() || doc.email || {}, ...b.email };
    if (b.voice) doc.voice = { ...doc.voice?.toObject?.() || doc.voice || {}, ...b.voice };
    if (b.capi) doc.capi = { ...doc.capi?.toObject?.() || doc.capi || {}, ...b.capi };
    if (doc.meta?.pageId || doc.meta?.formId || doc.meta?.accessTokenRef) {
      doc.health = doc.health === 'not_configured' ? 'unknown' : doc.health;
    }
    await doc.save();
    await writeAudit({
      tenantId: req.tenantId,
      actorUserId: req.zfUser.id,
      actorLabel: req.zfUser.name,
      action: 'integration.upsert',
      objectType: 'integration',
      objectId: doc._id.toString(),
      after: Integration.toPublic(doc),
      correlationId: req.correlationId
    });
    return res.json({ integration: Integration.toPublic(doc) });
  } catch (err) {
    return next(err);
  }
}

async function listAutomations(req, res, next) {
  try {
    const items = await AutomationRule.find({ tenantId: req.tenantId }).sort({ priority: 1 });
    return res.json({ items: items.map(AutomationRule.toPublic) });
  } catch (err) {
    return next(err);
  }
}

async function upsertAutomation(req, res, next) {
  try {
    const b = req.body || {};
    let doc = b.id ? await AutomationRule.findOne({ _id: b.id, tenantId: req.tenantId }) : null;
    if (!doc) {
      doc = new AutomationRule({ tenantId: req.tenantId, name: b.name || 'Rule', trigger: b.trigger || 'lead.created' });
    }
    if (b.name) doc.name = b.name;
    if (b.trigger) doc.trigger = b.trigger;
    if (b.conditions) doc.conditions = b.conditions;
    if (b.actions) doc.actions = b.actions;
    if (b.priority != null) doc.priority = b.priority;
    if (b.active != null) doc.active = b.active;
    if (b.cooldown_minutes != null) doc.cooldownMinutes = b.cooldown_minutes;
    doc.version += 1;
    await doc.save();
    return res.json({ rule: AutomationRule.toPublic(doc) });
  } catch (err) {
    return next(err);
  }
}

async function listAudit(req, res, next) {
  try {
    const { page, limit, skip } = pagination(req.query);
    const filter = {};
    if (req.tenantId) filter.tenantId = req.tenantId;
    if (req.query.action) filter.action = req.query.action;
    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AuditLog.countDocuments(filter)
    ]);
    return res.json({ items: items.map(AuditLog.toPublic), total, page, limit });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  platformOverview,
  listTenants,
  createTenant,
  getTenant,
  updateTenant,
  listBranches,
  createBranch,
  listUsers,
  createUser,
  listProducts,
  createProduct,
  listIntegrations,
  upsertIntegration,
  listAutomations,
  upsertAutomation,
  listAudit
};
