const mongoose = require('mongoose');

const automationSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfTenant', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    trigger: { type: String, required: true },
    conditions: { type: mongoose.Schema.Types.Mixed, default: {} },
    actions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    priority: { type: Number, default: 100 },
    active: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
    cooldownMinutes: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 }
  },
  { timestamps: true, collection: 'zf_automation_rules' }
);

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    tenant_id: doc.tenantId.toString(),
    name: doc.name,
    trigger: doc.trigger,
    conditions: doc.conditions,
    actions: doc.actions,
    priority: doc.priority,
    active: doc.active,
    version: doc.version,
    cooldown_minutes: doc.cooldownMinutes,
    max_attempts: doc.maxAttempts,
    created_at: doc.createdAt.toISOString(),
    updated_at: doc.updatedAt.toISOString()
  };
}

automationSchema.statics.toPublic = toPublic;

module.exports = mongoose.models.ZfAutomationRule || mongoose.model('ZfAutomationRule', automationSchema);
