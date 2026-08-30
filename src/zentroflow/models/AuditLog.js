const mongoose = require('mongoose');

const auditSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfTenant', default: null, index: true },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfUser', default: null },
    actorLabel: { type: String, default: 'system' },
    action: { type: String, required: true, index: true },
    objectType: { type: String, required: true },
    objectId: { type: String, default: '' },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    correlationId: { type: String, default: '' }
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'zf_audit_logs' }
);

auditSchema.index({ tenantId: 1, createdAt: -1 });

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    tenant_id: doc.tenantId ? doc.tenantId.toString() : null,
    actor_user_id: doc.actorUserId ? doc.actorUserId.toString() : null,
    actor_label: doc.actorLabel,
    action: doc.action,
    object_type: doc.objectType,
    object_id: doc.objectId || '',
    before: doc.before,
    after: doc.after,
    ip: doc.ip || '',
    correlation_id: doc.correlationId || '',
    created_at: doc.createdAt.toISOString()
  };
}

auditSchema.statics.toPublic = toPublic;

module.exports = mongoose.models.ZfAuditLog || mongoose.model('ZfAuditLog', auditSchema);
