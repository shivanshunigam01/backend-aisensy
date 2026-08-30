const { Lead, Activity, FollowUp, Assignment, Customer } = require('../models');
const { pagination, temperatureFromScore } = require('../utils/helpers');
const { writeAudit } = require('./auditService');
const { routeLead } = require('./routingService');
const { applyScoreRules } = require('./scoringService');
const { Tenant } = require('../models');
const { enqueueJob } = require('./jobService');
const crypto = require('crypto');

function buildLeadFilter(tenantId, query, zfUser) {
  const filter = { tenantId, deleted: false };

  if (query.stage) filter.currentStage = query.stage;
  if (query.verification_status) filter.verificationStatus = query.verification_status;
  if (query.qualification_status) filter.qualificationStatus = query.qualification_status;
  if (query.temperature) filter.temperature = query.temperature;
  if (query.branch_id) filter.branchId = query.branch_id;
  if (query.assigned_user_id) filter.assignedUserId = query.assigned_user_id;
  if (query.product) filter['interest.product'] = query.product;
  if (query.source_channel) filter['attribution.sourceChannel'] = query.source_channel;
  if (query.campaign_id) filter['attribution.campaignId'] = query.campaign_id;
  if (query.overdue === 'true' || query.overdue === true) filter.overdue = true;
  if (query.q) {
    const s = String(query.q).trim();
    filter.$or = [
      { name: new RegExp(s, 'i') },
      { mobile: new RegExp(s, 'i') },
      { email: new RegExp(s, 'i') },
      { 'interest.product': new RegExp(s, 'i') },
      { lastRemark: new RegExp(s, 'i') }
    ];
  }
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  // Scope executives to own leads
  if (zfUser?.role === 'client_executive') {
    filter.assignedUserId = zfUser.id;
  } else if (zfUser?.role === 'client_manager' && zfUser.branchIds?.length) {
    filter.branchId = { $in: zfUser.branchIds };
  }

  return filter;
}

async function listLeads(tenantId, query, zfUser) {
  const { page, limit, skip } = pagination(query);
  const filter = buildLeadFilter(tenantId, query, zfUser);
  const sortField = query.sort || 'createdAt';
  const sortDir = query.order === 'asc' ? 1 : -1;

  const [items, total] = await Promise.all([
    Lead.find(filter)
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(limit),
    Lead.countDocuments(filter)
  ]);

  return { items: items.map(Lead.toPublic), total, page, limit };
}

async function getLead(tenantId, leadId, zfUser) {
  const filter = { _id: leadId, tenantId, deleted: false };
  if (zfUser?.role === 'client_executive') filter.assignedUserId = zfUser.id;
  const lead = await Lead.findOne(filter);
  if (!lead) return null;

  const [activities, followups, assignments, customer] = await Promise.all([
    Activity.find({ tenantId, leadId }).sort({ createdAt: -1 }).limit(200),
    FollowUp.find({ tenantId, leadId }).sort({ dueAt: -1 }).limit(100),
    Assignment.find({ tenantId, leadId }).sort({ createdAt: -1 }).limit(50),
    Customer.findById(lead.customerId)
  ]);

  return {
    lead: Lead.toPublic(lead),
    customer: customer ? Customer.toPublic(customer) : null,
    timeline: activities.map(Activity.toPublic),
    followups: followups.map(FollowUp.toPublic),
    assignments: assignments.map(Assignment.toPublic)
  };
}

async function changeStage(tenantId, leadId, { stage, reason, actor }, opts = {}) {
  const lead = await Lead.findOne({ _id: leadId, tenantId, deleted: false });
  if (!lead) return null;
  const old = lead.currentStage;
  lead.currentStage = stage;
  if (reason) lead.subStatus = reason;
  if (stage === 'lost' && reason) lead.outcome.lostReason = reason;
  await lead.save();

  await Activity.create({
    tenantId,
    leadId: lead._id,
    customerId: lead.customerId,
    type: 'stage_changed',
    actorUserId: actor?.id || null,
    actorLabel: actor?.name || 'user',
    content: `Stage ${old} → ${stage}${reason ? `: ${reason}` : ''}`,
    metadata: { old_stage: old, new_stage: stage, reason }
  });

  await writeAudit({
    tenantId,
    actorUserId: actor?.id,
    actorLabel: actor?.name,
    action: 'lead.stage_change',
    objectType: 'lead',
    objectId: leadId,
    before: { stage: old },
    after: { stage, reason },
    correlationId: opts.correlationId
  });

  // CAPI hook for downstream outcomes
  const capiStages = ['qualified', 'appointment', 'test_drive', 'booking', 'sale'];
  if (capiStages.includes(stage)) {
    const hash = crypto.createHash('sha256').update(`${leadId}:${stage}:${Date.now()}`).digest('hex').slice(0, 32);
    await enqueueJob({
      tenantId,
      type: 'capi_send',
      payload: { lead_id: leadId, event_name: stage, event_time: new Date().toISOString() },
      correlationId: opts.correlationId,
      idempotencyKey: `capi:${leadId}:${stage}:${hash}`
    });
  }

  return Lead.toPublic(lead);
}

async function addRemark(tenantId, leadId, { content, actor }) {
  const lead = await Lead.findOne({ _id: leadId, tenantId, deleted: false });
  if (!lead) return null;
  lead.lastRemark = content;
  lead.lastContactAt = new Date();
  await lead.save();

  const activity = await Activity.create({
    tenantId,
    leadId: lead._id,
    customerId: lead.customerId,
    type: 'remark',
    channel: 'crm',
    actorUserId: actor?.id || null,
    actorLabel: actor?.name || 'user',
    content
  });

  return { lead: Lead.toPublic(lead), activity: Activity.toPublic(activity) };
}

async function createFollowUp(tenantId, leadId, body, actor) {
  const lead = await Lead.findOne({ _id: leadId, tenantId, deleted: false });
  if (!lead) return null;

  const fu = await FollowUp.create({
    tenantId,
    leadId,
    ownerUserId: body.owner_user_id || lead.assignedUserId || actor?.id || null,
    type: body.type || 'call',
    dueAt: new Date(body.due_at),
    status: 'open',
    reminderAt: body.reminder_at ? new Date(body.reminder_at) : null,
    remark: body.remark || '',
    createdByUserId: actor?.id || null
  });

  lead.nextFollowupAt = fu.dueAt;
  lead.overdue = false;
  await lead.save();

  await Activity.create({
    tenantId,
    leadId,
    customerId: lead.customerId,
    type: 'followup_created',
    actorUserId: actor?.id || null,
    actorLabel: actor?.name || 'user',
    content: `Follow-up scheduled for ${fu.dueAt.toISOString()}`,
    metadata: { followup_id: fu._id.toString(), type: fu.type }
  });

  return FollowUp.toPublic(fu);
}

async function completeFollowUp(tenantId, followUpId, { outcome, remark, actor }) {
  const fu = await FollowUp.findOne({ _id: followUpId, tenantId });
  if (!fu) return null;
  fu.status = 'done';
  fu.outcome = outcome || '';
  fu.remark = remark || fu.remark;
  fu.completedAt = new Date();
  await fu.save();

  const lead = await Lead.findById(fu.leadId);
  if (lead) {
    lead.lastContactAt = new Date();
    if (remark) lead.lastRemark = remark;
    // next open follow-up
    const next = await FollowUp.findOne({ tenantId, leadId: lead._id, status: 'open' }).sort({ dueAt: 1 });
    lead.nextFollowupAt = next ? next.dueAt : null;
    lead.overdue = false;
    await lead.save();

    await Activity.create({
      tenantId,
      leadId: lead._id,
      customerId: lead.customerId,
      type: 'followup_completed',
      actorUserId: actor?.id || null,
      actorLabel: actor?.name || 'user',
      content: outcome || 'Follow-up completed',
      metadata: { followup_id: fu._id.toString() }
    });
  }

  return FollowUp.toPublic(fu);
}

async function assignLead(tenantId, leadId, body, actor) {
  const lead = await Lead.findOne({ _id: leadId, tenantId, deleted: false });
  if (!lead) return null;
  await routeLead(lead, {
    toUserId: body.to_user_id || null,
    toBranchId: body.to_branch_id || null,
    mode: body.mode || 'manual',
    reason: body.reason || 'manual_assign',
    actorUserId: actor?.id || null
  });
  return Lead.toPublic(lead);
}

async function verifyLead(tenantId, leadId, body, actor) {
  const lead = await Lead.findOne({ _id: leadId, tenantId, deleted: false });
  if (!lead) return null;

  lead.verificationStatus = body.verification_status || 'verified';
  lead.qualificationStatus = body.qualification_status || lead.qualificationStatus;
  if (body.qualification_status === 'qualified') lead.currentStage = 'qualified';
  if (body.qualification_status === 'warm_nurture') lead.currentStage = 'nurture';
  if (body.qualification_status === 'not_interested') lead.currentStage = 'not_interested';
  if (body.qualification_status === 'invalid') lead.currentStage = 'invalid';

  if (body.interest) {
    Object.assign(lead.interest, {
      product: body.interest.product ?? lead.interest.product,
      variant: body.interest.variant ?? lead.interest.variant,
      buyerType: body.interest.buyer_type ?? lead.interest.buyerType,
      purchaseTimeline: body.interest.purchase_timeline ?? lead.interest.purchaseTimeline,
      financeRequired: body.interest.finance_required ?? lead.interest.financeRequired,
      exchangeRequired: body.interest.exchange_required ?? lead.interest.exchangeRequired
    });
  }

  const tenant = await Tenant.findById(tenantId);
  const scored = applyScoreRules(tenant?.scoreRules || [], {
    purchase_timeline: lead.interest.purchaseTimeline,
    stage: lead.currentStage,
    verification_status: lead.verificationStatus,
    bot_qualified: Boolean(body.bot_qualified)
  });
  lead.leadScore = scored.score;
  lead.scoreReasons = scored.reasons;
  lead.temperature = temperatureFromScore(scored.score);
  await lead.save();

  await Activity.create({
    tenantId,
    leadId: lead._id,
    customerId: lead.customerId,
    type: 'verification',
    actorUserId: actor?.id || null,
    actorLabel: actor?.name || 'verifier',
    content: body.remark || `Verification: ${lead.verificationStatus} / ${lead.qualificationStatus}`,
    metadata: body
  });

  await writeAudit({
    tenantId,
    actorUserId: actor?.id,
    actorLabel: actor?.name,
    action: 'lead.verify',
    objectType: 'lead',
    objectId: leadId,
    after: {
      verification_status: lead.verificationStatus,
      qualification_status: lead.qualificationStatus,
      stage: lead.currentStage
    }
  });

  return Lead.toPublic(lead);
}

async function markOverdueFollowUps() {
  const now = new Date();
  await FollowUp.updateMany(
    { status: 'open', dueAt: { $lt: now } },
    { $set: { status: 'overdue' } }
  );
  await Lead.updateMany(
    { deleted: false, nextFollowupAt: { $lt: now }, overdue: false },
    { $set: { overdue: true } }
  );
}

async function exportLeads(tenantId, query, zfUser, actor) {
  const filter = buildLeadFilter(tenantId, { ...query, limit: undefined }, zfUser);
  const items = await Lead.find(filter).sort({ createdAt: -1 }).limit(5000);
  await writeAudit({
    tenantId,
    actorUserId: actor?.id,
    actorLabel: actor?.name,
    action: 'lead.export',
    objectType: 'lead',
    objectId: '',
    after: { row_count: items.length, filters: query }
  });
  return items.map(Lead.toPublic);
}

module.exports = {
  listLeads,
  getLead,
  changeStage,
  addRemark,
  createFollowUp,
  completeFollowUp,
  assignLead,
  verifyLead,
  markOverdueFollowUps,
  exportLeads,
  buildLeadFilter
};
