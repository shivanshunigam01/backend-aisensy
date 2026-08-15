const bcrypt = require('bcryptjs');
const AdminUser = require('../models/AdminUser');
const { env } = require('../config/env');
const { signJwt } = require('../utils/jwt');

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

async function login(email, password) {
  const normalized = normalizeEmail(email);
  if (!normalized || !password) {
    return { ok: false, status: 400, error: 'Email and password are required.' };
  }

  const user = await AdminUser.findOne({ email: normalized }).select('+passwordHash');
  if (!user) {
    return { ok: false, status: 401, error: 'Invalid email or password.' };
  }

  const match = await bcrypt.compare(String(password), user.passwordHash);
  if (!match) {
    return { ok: false, status: 401, error: 'Invalid email or password.' };
  }

  const token = signJwt({ sub: user._id.toString(), email: user.email, role: user.role }, env.adminJwtSecret);
  return { ok: true, token, admin: AdminUser.toPublic(user) };
}

async function getMe(adminId) {
  const user = await AdminUser.findById(adminId);
  if (!user) return { ok: false, status: 404, error: 'Admin user not found.' };
  return { ok: true, admin: AdminUser.toPublic(user) };
}

async function seedAdminIfNeeded() {
  const count = await AdminUser.countDocuments();
  if (count > 0) return;

  const email = normalizeEmail(env.adminSeedEmail);
  const password = env.adminSeedPassword;
  if (!email || !password) {
    console.warn('[admin] No admin users and ADMIN_SEED_EMAIL/PASSWORD not set — skipping seed.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await AdminUser.create({
    email,
    passwordHash,
    name: 'Super Admin',
    role: 'superadmin'
  });
  console.log(`[admin] Seeded admin user: ${email}`);
}

module.exports = { login, getMe, seedAdminIfNeeded };
