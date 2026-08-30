const mongoose = require('mongoose');
const { ACTIVITY_TYPES } = require('../constants');

const activitySchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfTenant', required: true, index: true },
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfLead', required: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfCustomer', default: null },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    channel: { type: String, default: 'system' },
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfUser', default: null },
    actorLabel: { type: String, default: 'system' },
    content: { type: String, default: '', maxlength: 8000 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'zf_activities' }
);

activitySchema.index({ tenantId: 1, leadId: 1, createdAt: -1 });

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    tenant_id: doc.tenantId.toString(),
    lead_id: doc.leadId.toString(),
    customer_id: doc.customerId ? doc.customerId.toString() : null,
    type: doc.type,
    channel: doc.channel,
    actor_user_id: doc.actorUserId ? doc.actorUserId.toString() : null,
    actor_label: doc.actorLabel,
    content: doc.content,
    metadata: doc.metadata || {},
    created_at: doc.createdAt.toISOString()
  };
}

activitySchema.statics.toPublic = toPublic;

module.exports = mongoose.models.ZfActivity || mongoose.model('ZfActivity', activitySchema);
