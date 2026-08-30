const bcrypt = require('bcryptjs');
const { User, Tenant } = require('../models');
const { signJwt } = require('../../utils/jwt');
const { env } = require('../../config/env');
const { writeAudit } = require('./auditService');
const { slugifyKey } = require('../utils/helpers');

async function login(email, password) {
  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+passwordHash');
  if (!user || user.status !== 'active') {
    return { ok: false, message: 'Invalid email or password' };
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return { ok: false, message: 'Invalid email or password' };

  const token = signJwt(
    {
      sub: user._id.toString(),
      aud: 'zentroflow',
      role: user.role,
      tenant_id: user.tenantId ? user.tenantId.toString() : null
    },
    env.zfJwtSecret || env.adminJwtSecret,
    7 * 86400
  );

  await writeAudit({
    tenantId: user.tenantId,
    actorUserId: user._id,
    actorLabel: user.name,
    action: 'auth.login',
    objectType: 'user',
    objectId: user._id.toString()
  });

  return { ok: true, token, user: User.toPublic(user) };
}

async function createUser(data, actor) {
  const existing = await User.findOne({ email: String(data.email).toLowerCase().trim() });
  if (existing) {
    const err = new Error('Email already registered');
    err.code = 'CONFLICT';
    throw err;
  }
  const passwordHash = await bcrypt.hash(data.password || 'ChangeMe@123', 10);
  const user = await User.create({
    email: String(data.email).toLowerCase().trim(),
    passwordHash,
    name: data.name,
    phone: data.phone || '',
    role: data.role,
    tenantId: data.tenant_id || null,
    branchIds: data.branch_ids || [],
    status: 'active',
    permissions: data.permissions || []
  });

  await writeAudit({
    tenantId: user.tenantId,
    actorUserId: actor?.id,
    actorLabel: actor?.name,
    action: 'user.create',
    objectType: 'user',
    objectId: user._id.toString(),
    after: User.toPublic(user)
  });

  return User.toPublic(user);
}

async function seedSuperAdmin() {
  const email = (env.zfSeedEmail || 'flow@zentroverse.in').toLowerCase();
  let user = await User.findOne({ email });
  if (user) return User.toPublic(user);

  const passwordHash = await bcrypt.hash(env.zfSeedPassword || 'ZentroFlow@2026', 10);
  user = await User.create({
    email,
    passwordHash,
    name: 'ZentroFlow Super Admin',
    role: 'super_admin',
    tenantId: null,
    status: 'active',
    permissions: ['*']
  });
  console.log(`[zentroflow] seeded super admin ${email}`);
  return User.toPublic(user);
}

async function onboardTenant(data, actor) {
  const key = data.key || slugifyKey(data.name);
  const existing = await Tenant.findOne({ key });
  if (existing) {
    const err = new Error('Tenant key already exists');
    err.code = 'CONFLICT';
    throw err;
  }

  const tenant = await Tenant.create({
    name: data.name,
    key,
    status: data.status || 'onboarding',
    plan: data.plan || 'standard',
    timezone: data.timezone || 'Asia/Kolkata',
    contact: data.contact || {},
    notes: data.notes || ''
  });

  let adminUser = null;
  if (data.admin_email) {
    adminUser = await createUser(
      {
        email: data.admin_email,
        password: data.admin_password || 'ChangeMe@123',
        name: data.admin_name || `${data.name} Admin`,
        role: 'client_admin',
        tenant_id: tenant._id.toString()
      },
      actor
    );
  }

  await writeAudit({
    tenantId: tenant._id,
    actorUserId: actor?.id,
    actorLabel: actor?.name,
    action: 'tenant.create',
    objectType: 'tenant',
    objectId: tenant._id.toString(),
    after: Tenant.toPublic(tenant)
  });

  return { tenant: Tenant.toPublic(tenant), admin: adminUser };
}

module.exports = { login, createUser, seedSuperAdmin, onboardTenant };
