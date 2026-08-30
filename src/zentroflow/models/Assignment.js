const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfTenant', required: true, index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfLead', required: true, index: true },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfUser', default: null },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfUser', default: null },
    fromBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfBranch', default: null },
    toBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfBranch', default: null },
    reason: { type: String, default: '' },
    mode: { type: String, enum: ['manual', 'rule', 'round_robin', 'fallback'], default: 'manual' },
    ruleId: { type: String, default: '' },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfUser', default: null }
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'zf_assignments' }
);

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    tenant_id: doc.tenantId.toString(),
    lead_id: doc.leadId.toString(),
    from_user_id: doc.fromUserId ? doc.fromUserId.toString() : null,
    to_user_id: doc.toUserId ? doc.toUserId.toString() : null,
    from_branch_id: doc.fromBranchId ? doc.fromBranchId.toString() : null,
    to_branch_id: doc.toBranchId ? doc.toBranchId.toString() : null,
    reason: doc.reason || '',
    mode: doc.mode,
    rule_id: doc.ruleId || '',
    actor_user_id: doc.actorUserId ? doc.actorUserId.toString() : null,
    created_at: doc.createdAt.toISOString()
  };
}

assignmentSchema.statics.toPublic = toPublic;

module.exports = mongoose.models.ZfAssignment || mongoose.model('ZfAssignment', assignmentSchema);
