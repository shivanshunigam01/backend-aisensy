const bcrypt = require('bcryptjs');
const { env } = require('../../config/env');
const { signJwt, verifyJwt } = require('../../utils/jwt');
const { HrUser, HrOrganization, toPublicUser } = require('../models');
const { fail } = require('../utils/helpers');

function hrSecret() {
  return env.hrJwtSecret || env.adminJwtSecret;
}

function signHrToken(user) {
  return signJwt(
    {
      sub: user._id.toString(),
      aud: 'zentro-hr',
      role: user.role,
      organizationId: user.organizationId.toString()
    },
    hrSecret(),
    7 * 86400
  );
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

async function requireHrAuth(req, res, next) {
  try {
    const legacy = req.headers['x-admin-token'];
    if (legacy && legacy === env.adminToken) {
      req.hrUser = {
        id: null,
        role: 'SUPER_ADMIN',
        organizationId: null,
        name: 'Platform Admin',
        email: 'admin@local',
        isPlatform: true
      };
      return next();
    }

    const auth = req.headers.authorization || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (!match) return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');

    const token = match[1];
    const hrPayload = verifyJwt(token, hrSecret());
    if (hrPayload?.sub && hrPayload?.aud === 'zentro-hr') {
      const user = await HrUser.findById(hrPayload.sub);
      if (!user || !user.isActive) return fail(res, 'Invalid or disabled user', 401, 'UNAUTHORIZED');
      req.hrUser = {
        id: user._id.toString(),
        role: user.role,
        organizationId: user.organizationId.toString(),
        name: user.name,
        email: user.email,
        employeeId: user.employeeId || null,
        isPlatform: false
      };
      return next();
    }

    const adminPayload = verifyJwt(token, env.adminJwtSecret);
    if (adminPayload?.sub) {
      req.hrUser = {
        id: adminPayload.sub,
        role: 'SUPER_ADMIN',
        organizationId: null,
        name: 'Platform Admin',
        email: '',
        isPlatform: true
      };
      return next();
    }

    return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
  } catch (err) {
    return next(err);
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.hrUser) return fail(res, 'Unauthorized', 401, 'UNAUTHORIZED');
    if (req.hrUser.isPlatform || roles.includes(req.hrUser.role)) return next();
    return fail(res, 'Forbidden', 403, 'FORBIDDEN');
  };
}

async function publicUserFromId(userId) {
  const user = await HrUser.findById(userId);
  if (!user) return null;
  const org = await HrOrganization.findById(user.organizationId).select('name');
  return toPublicUser(user, org?.name);
}

module.exports = {
  signHrToken,
  hashPassword,
  verifyPassword,
  requireHrAuth,
  requireRoles,
  publicUserFromId,
  hrSecret
};
