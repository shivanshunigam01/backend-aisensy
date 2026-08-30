const { Job } = require('../models');

async function enqueueJob({ tenantId, type, payload, correlationId, idempotencyKey, delayMs = 0 }) {
  if (idempotencyKey) {
    const existing = await Job.findOne({ idempotencyKey, type });
    if (existing) return existing;
  }

  return Job.create({
    tenantId: tenantId || null,
    type,
    status: 'pending',
    payload: payload || {},
    attempts: 0,
    nextRetryAt: delayMs ? new Date(Date.now() + delayMs) : new Date(),
    correlationId: correlationId || '',
    idempotencyKey: idempotencyKey || ''
  });
}

async function listJobs({ tenantId, status, type, page = 1, limit = 25 }) {
  const filter = {};
  if (tenantId) filter.tenantId = tenantId;
  if (status) filter.status = status;
  if (type) filter.type = type;
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Job.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Job.countDocuments(filter)
  ]);
  return { items: items.map(Job.toPublic), total, page, limit };
}

async function retryJob(id) {
  const job = await Job.findById(id);
  if (!job) return null;
  job.status = 'pending';
  job.nextRetryAt = new Date();
  job.lastError = '';
  await job.save();
  return Job.toPublic(job);
}

/** In-process tick — processes due jobs without Redis for MVP. */
async function processDueJobs(handlers = {}) {
  const due = await Job.find({
    status: { $in: ['pending', 'failed'] },
    $or: [{ nextRetryAt: null }, { nextRetryAt: { $lte: new Date() } }],
    attempts: { $lt: 5 }
  })
    .sort({ nextRetryAt: 1 })
    .limit(20);

  for (const job of due) {
    const handler = handlers[job.type];
    job.status = 'processing';
    job.attempts += 1;
    await job.save();
    try {
      if (!handler) {
        // Reserved hooks (whatsapp/email/dialer/capi) stay queued-success stubs until keys arrive
        job.status = 'succeeded';
        job.result = { stub: true, message: `No handler for ${job.type}; reserved for provider wiring` };
        await job.save();
        continue;
      }
      const result = await handler(job);
      job.status = 'succeeded';
      job.result = result || { ok: true };
      job.lastError = '';
      await job.save();
    } catch (err) {
      job.lastError = err.message || String(err);
      if (job.attempts >= job.maxAttempts) {
        job.status = 'dead';
      } else {
        job.status = 'failed';
        job.nextRetryAt = new Date(Date.now() + Math.min(3600000, 2000 * 2 ** job.attempts));
      }
      await job.save();
    }
  }
  return due.length;
}

module.exports = { enqueueJob, listJobs, retryJob, processDueJobs };
