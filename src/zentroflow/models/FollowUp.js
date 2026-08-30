const mongoose = require('mongoose');
const { FOLLOWUP_STATUSES, FOLLOWUP_TYPES } = require('../constants');

const followUpSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfTenant', required: true, index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfLead', required: true, index: true },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfUser', default: null, index: true },
    type: { type: String, enum: FOLLOWUP_TYPES, default: 'call' },
    dueAt: { type: Date, required: true, index: true },
    status: { type: String, enum: FOLLOWUP_STATUSES, default: 'open', index: true },
    reminderAt: { type: Date, default: null },
    outcome: { type: String, default: '' },
    remark: { type: String, default: '', maxlength: 4000 },
    completedAt: { type: Date, default: null },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfUser', default: null }
  },
  { timestamps: true, collection: 'zf_followups' }
);

followUpSchema.index({ tenantId: 1, dueAt: 1, status: 1 });

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    tenant_id: doc.tenantId.toString(),
    lead_id: doc.leadId.toString(),
    owner_user_id: doc.ownerUserId ? doc.ownerUserId.toString() : null,
    type: doc.type,
    due_at: doc.dueAt.toISOString(),
    status: doc.status,
    reminder_at: doc.reminderAt ? doc.reminderAt.toISOString() : null,
    outcome: doc.outcome || '',
    remark: doc.remark || '',
    completed_at: doc.completedAt ? doc.completedAt.toISOString() : null,
    created_by_user_id: doc.createdByUserId ? doc.createdByUserId.toString() : null,
    created_at: doc.createdAt.toISOString(),
    updated_at: doc.updatedAt.toISOString()
  };
}

followUpSchema.statics.toPublic = toPublic;

module.exports = mongoose.models.ZfFollowUp || mongoose.model('ZfFollowUp', followUpSchema);
