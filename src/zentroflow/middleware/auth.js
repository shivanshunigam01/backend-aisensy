const { env } = require('../../config/env');
const { verifyJwt } = require('../../utils/jwt');
const { User } = require('../models');
const { errorEnvelope } = require('../utils/helpers');

async function requireZfAuth(req, res, next) {
  try {
    // Super-admin of main panel may act as platform super_admin
    const legacy = req.headers['x-admin-token'];
    if (legacy && legacy === env.adminToken) {
      req.zfUser = {
        id: null,
        role: 'super_admin',
        tenantId: null,
        branchIds: [],
        name: 'Legacy Admin',
        email: 'admin@local',
        permissions: ['*']
      };
      return next();
    }

    const auth = req.headers.authorization || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json(errorEnvelope('UNAUTHORIZED', 'Unauthorized', req.correlationId));
    }

    const token = match[1];

    // Prefer ZentroFlow JWT
    const zfPayload = verifyJwt(token, env.zfJwtSecret || env.adminJwtSecret);
    if (zfPayload?.sub && zfPayload?.aud === 'zentroflow') {
      const user = await User.findById(zfPayload.sub);
      if (!user || user.status !== 'active') {
        return res.status(401).json(errorEnvelope('UNAUTHORIZED', 'Invalid or disabled user', req.correlationId));
      }
      req.zfUser = {
        id: user._id.toString(),
        role: user.role,
        tenantId: user.tenantId ? user.tenantId.toString() : null,
        branchIds: (user.branchIds || []).map((b) => b.toString()),
        name: user.name,
        email: user.email,
        permissions: user.permissions || []
      };
      return next();
    }

    // Fall back: main admin JWT as platform super_admin
    const adminPayload = verifyJwt(token, env.adminJwtSecret);
    if (adminPayload?.sub) {
      req.zfUser = {
        id: adminPayload.sub,
        role: 'super_admin',
        tenantId: null,
        branchIds: [],
        name: 'Platform Admin',
        email: '',
        permissions: ['*']
      };
      return next();
    }

    return res.status(401).json(errorEnvelope('UNAUTHORIZED', 'Invalid or expired token', req.correlationId));
  } catch (err) {
    return next(err);
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.zfUser) {
      return res.status(401).json(errorEnvelope('UNAUTHORIZED', 'Unauthorized', req.correlationId));
    }
    if (req.zfUser.role === 'super_admin' || req.zfUser.permissions.includes('*')) return next();
    if (roles.includes(req.zfUser.role)) return next();
    return res.status(403).json(errorEnvelope('FORBIDDEN', 'Insufficient role', req.correlationId));
  };
}

/** Resolve tenant scope for the request. Super admin may pass ?tenant_id= or x-tenant-id. */
function resolveTenantScope(req, res, next) {
  const headerTenant = req.headers['x-tenant-id'];
  const queryTenant = req.query.tenant_id;
  const bodyTenant = req.body?.tenant_id;

  if (req.zfUser.role === 'super_admin' || req.zfUser.role === 'ops_verifier') {
    req.tenantId = headerTenant || queryTenant || bodyTenant || req.zfUser.tenantId || null;
  } else {
    req.tenantId = req.zfUser.tenantId;
    if (!req.tenantId) {
      return res.status(403).json(errorEnvelope('FORBIDDEN', 'User has no tenant scope', req.correlationId));
    }
  }
  next();
}

function requireTenant(req, res, next) {
  if (!req.tenantId) {
    return res.status(400).json(errorEnvelope('TENANT_REQUIRED', 'tenant_id is required', req.correlationId));
  }
  next();
}

module.exports = { requireZfAuth, requireRoles, resolveTenantScope, requireTenant };
