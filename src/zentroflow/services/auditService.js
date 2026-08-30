const { AuditLog } = require('../models');

async function writeAudit({ tenantId, actorUserId, actorLabel, action, objectType, objectId, before, after, ip, userAgent, correlationId }) {
  try {
    await AuditLog.create({
      tenantId: tenantId || null,
      actorUserId: actorUserId || null,
      actorLabel: actorLabel || 'system',
      action,
      objectType,
      objectId: objectId || '',
      before: before || null,
      after: after || null,
      ip: ip || '',
      userAgent: userAgent || '',
      correlationId: correlationId || ''
    });
  } catch (err) {
    console.error('[zentroflow] audit write failed', err.message);
  }
}

module.exports = { writeAudit };
