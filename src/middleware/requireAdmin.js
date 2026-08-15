const { env } = require('../config/env');

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || token !== env.adminToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

module.exports = { requireAdmin };
