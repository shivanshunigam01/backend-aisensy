const leadService = require('../services/leadService');
const ingestService = require('../services/ingestService');
const dashboardService = require('../services/dashboardService');
const jobService = require('../services/jobService');
const metaService = require('../services/metaService');
const { CapiEvent } = require('../models');
const { errorEnvelope } = require('../utils/helpers');

function actor(req) {
  return { id: req.zfUser?.id, name: req.zfUser?.name || req.zfUser?.email || 'user' };
}

async function dashboard(req, res, next) {
  try {
    const data = await dashboardService.getDashboard(req.tenantId, {
      from: req.query.from,
      to: req.query.to
    });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function listLeads(req, res, next) {
  try {
    const data = await leadService.listLeads(req.tenantId, req.query, req.zfUser);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function getLead(req, res, next) {
  try {
    const data = await leadService.getLead(req.tenantId, req.params.id, req.zfUser);
    if (!data) return res.status(404).json(errorEnvelope('NOT_FOUND', 'Lead not found', req.correlationId));
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function ingest(req, res, next) {
  try {
    const result = await ingestService.ingestLead(req.body || {}, {
      actorLabel: 'api',
      correlationId: req.correlationId,
      idempotencyKey: req.headers['idempotency-key']
    });
    return res.status(result.created ? 201 : 200).json(result);
  } catch (err) {
    if (err.code === 'VALIDATION' || err.code === 'TENANT_NOT_FOUND') {
      return res.status(err.code === 'TENANT_NOT_FOUND' ? 404 : 400).json(
        errorEnvelope(err.code, err.message, req.correlationId)
      );
    }
    return next(err);
  }
}

async function changeStage(req, res, next) {
  try {
    const lead = await leadService.changeStage(
      req.tenantId,
      req.params.id,
      { stage: req.body.stage, reason: req.body.reason, actor: actor(req) },
      { correlationId: req.correlationId }
    );
    if (!lead) return res.status(404).json(errorEnvelope('NOT_FOUND', 'Lead not found', req.correlationId));
    return res.json({ lead });
  } catch (err) {
    return next(err);
  }
}

async function addRemark(req, res, next) {
  try {
    if (!req.body?.content) {
      return res.status(400).json(errorEnvelope('VALIDATION', 'content required', req.correlationId));
    }
    const result = await leadService.addRemark(req.tenantId, req.params.id, {
      content: req.body.content,
      actor: actor(req)
    });
    if (!result) return res.status(404).json(errorEnvelope('NOT_FOUND', 'Lead not found', req.correlationId));
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function createFollowUp(req, res, next) {
  try {
    if (!req.body?.due_at) {
      return res.status(400).json(errorEnvelope('VALIDATION', 'due_at required', req.correlationId));
    }
    const fu = await leadService.createFollowUp(req.tenantId, req.params.id, req.body, actor(req));
    if (!fu) return res.status(404).json(errorEnvelope('NOT_FOUND', 'Lead not found', req.correlationId));
    return res.status(201).json({ followup: fu });
  } catch (err) {
    return next(err);
  }
}

async function completeFollowUp(req, res, next) {
  try {
    const fu = await leadService.completeFollowUp(req.tenantId, req.params.followUpId, {
      outcome: req.body?.outcome,
      remark: req.body?.remark,
      actor: actor(req)
    });
    if (!fu) return res.status(404).json(errorEnvelope('NOT_FOUND', 'Follow-up not found', req.correlationId));
    return res.json({ followup: fu });
  } catch (err) {
    return next(err);
  }
}

async function assign(req, res, next) {
  try {
    const lead = await leadService.assignLead(req.tenantId, req.params.id, req.body || {}, actor(req));
    if (!lead) return res.status(404).json(errorEnvelope('NOT_FOUND', 'Lead not found', req.correlationId));
    return res.json({ lead });
  } catch (err) {
    return next(err);
  }
}

async function verify(req, res, next) {
  try {
    const lead = await leadService.verifyLead(req.tenantId, req.params.id, req.body || {}, actor(req));
    if (!lead) return res.status(404).json(errorEnvelope('NOT_FOUND', 'Lead not found', req.correlationId));
    return res.json({ lead });
  } catch (err) {
    return next(err);
  }
}

async function exportLeads(req, res, next) {
  try {
    const items = await leadService.exportLeads(req.tenantId, req.query, req.zfUser, actor(req));
    return res.json({ items, count: items.length });
  } catch (err) {
    return next(err);
  }
}

async function listJobs(req, res, next) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 25);
    const data = await jobService.listJobs({
      tenantId: req.tenantId || undefined,
      status: req.query.status,
      type: req.query.type,
      page,
      limit
    });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function retryJob(req, res, next) {
  try {
    const job = await jobService.retryJob(req.params.id);
    if (!job) return res.status(404).json(errorEnvelope('NOT_FOUND', 'Job not found', req.correlationId));
    return res.json({ job });
  } catch (err) {
    return next(err);
  }
}

async function listCapi(req, res, next) {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.query.status) filter.status = req.query.status;
    const items = await CapiEvent.find(filter).sort({ createdAt: -1 }).limit(100);
    return res.json({ items: items.map(CapiEvent.toPublic) });
  } catch (err) {
    return next(err);
  }
}

async function metaVerify(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const ok = await metaService.verifyWebhookChallenge({ mode, token, challenge });
  if (ok != null) return res.status(200).send(ok);
  return res.sendStatus(403);
}

async function metaWebhook(req, res, next) {
  try {
    // Acknowledge quickly; heavy work is queued
    const result = await metaService.handleWebhookPayload(req.body, req.correlationId);
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    return next(err);
  }
}

async function processJobs(req, res, next) {
  try {
    await leadService.markOverdueFollowUps();
    const n = await jobService.processDueJobs({
      meta_lead_retrieve: metaService.retrieveAndIngestMetaLead
    });
    return res.json({ processed: n });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  dashboard,
  listLeads,
  getLead,
  ingest,
  changeStage,
  addRemark,
  createFollowUp,
  completeFollowUp,
  assign,
  verify,
  exportLeads,
  listJobs,
  retryJob,
  listCapi,
  metaVerify,
  metaWebhook,
  processJobs
};
