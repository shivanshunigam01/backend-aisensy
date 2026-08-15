const { env } = require('../config/env');
const { verifyJwt } = require('../utils/jwt');

function requireAdmin(req, res, next) {
  const legacy = req.headers['x-admin-token'];
  if (legacy && legacy === env.adminToken) {
    req.adminUserId = null;
    req.adminLegacy = true;
    return next();
  }

  const auth = req.headers.authorization || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const payload = verifyJwt(match[1], env.adminJwtSecret);
  if (!payload?.sub) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  req.adminUserId = payload.sub;
  req.adminLegacy = false;
  next();
}

module.exports = { requireAdmin };
