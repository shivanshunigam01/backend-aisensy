const mongoose = require('mongoose');
const { JOB_STATUSES, JOB_TYPES } = require('../constants');

const jobSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'ZfTenant', default: null, index: true },
    type: { type: String, enum: JOB_TYPES, required: true, index: true },
    status: { type: String, enum: JOB_STATUSES, default: 'pending', index: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    nextRetryAt: { type: Date, default: null, index: true },
    lastError: { type: String, default: '' },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    correlationId: { type: String, default: '', index: true },
    idempotencyKey: { type: String, default: '', index: true }
  },
  { timestamps: true, collection: 'zf_jobs' }
);

jobSchema.index({ status: 1, nextRetryAt: 1 });

function toPublic(doc) {
  return {
    id: doc._id.toString(),
    tenant_id: doc.tenantId ? doc.tenantId.toString() : null,
    type: doc.type,
    status: doc.status,
    payload: doc.payload,
    attempts: doc.attempts,
    max_attempts: doc.maxAttempts,
    next_retry_at: doc.nextRetryAt ? doc.nextRetryAt.toISOString() : null,
    last_error: doc.lastError || '',
    result: doc.result,
    correlation_id: doc.correlationId || '',
    created_at: doc.createdAt.toISOString(),
    updated_at: doc.updatedAt.toISOString()
  };
}

jobSchema.statics.toPublic = toPublic;

module.exports = mongoose.models.ZfJob || mongoose.model('ZfJob', jobSchema);
