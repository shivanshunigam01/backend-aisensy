const { Lead, Assignment, Activity, User, Branch } = require('../models');
const { writeAudit } = require('./auditService');

/**
 * Simple routing engine (SRS §10) — geography/product/round-robin with fallback.
 * Full weighted rules can be layered via AutomationRule later.
 */
async function routeLead(lead, { toUserId, toBranchId, mode = 'manual', reason = '', actorUserId = null, ruleId = '' } = {}) {
  const fromUserId = lead.assignedUserId;
  const fromBranchId = lead.branchId;

  let targetUserId = toUserId || null;
  let targetBranchId = toBranchId || lead.branchId || null;
  let usedMode = mode;

  if (!targetUserId && mode !== 'manual') {
    // Prefer branch manager, else round-robin executives in tenant
    if (targetBranchId) {
      const branch = await Branch.findById(targetBranchId);
      if (branch?.managerUserId) {
        targetUserId = branch.managerUserId;
        usedMode = 'rule';
        reason = reason || 'branch_manager';
      }
    }

    if (!targetUserId) {
      const executives = await User.find({
        tenantId: lead.tenantId,
        status: 'active',
        role: { $in: ['client_executive', 'client_manager', 'client_admin'] }
      }).select('_id');

      if (executives.length) {
        const counts = await Lead.aggregate([
          {
            $match: {
              tenantId: lead.tenantId,
              assignedUserId: { $in: executives.map((e) => e._id) },
              deleted: false,
              currentStage: { $nin: ['sale', 'lost', 'invalid'] }
            }
          },
          { $group: { _id: '$assignedUserId', n: { $sum: 1 } } }
        ]);
        const countMap = Object.fromEntries(counts.map((c) => [c._id.toString(), c.n]));
        executives.sort((a, b) => (countMap[a._id.toString()] || 0) - (countMap[b._id.toString()] || 0));
        targetUserId = executives[0]._id;
        usedMode = 'round_robin';
        reason = reason || 'lowest_workload';
      } else {
        usedMode = 'fallback';
        reason = reason || 'unmapped_queue';
      }
    }
  }

  lead.assignedUserId = targetUserId || null;
  if (targetBranchId) lead.branchId = targetBranchId;
  const now = new Date();
  if (!lead.assignmentAt) lead.assignmentAt = now;
  else lead.lastReassignmentAt = now;
  await lead.save();

  const assignment = await Assignment.create({
    tenantId: lead.tenantId,
    leadId: lead._id,
    fromUserId,
    toUserId: targetUserId,
    fromBranchId,
    toBranchId: targetBranchId,
    reason,
    mode: usedMode,
    ruleId,
    actorUserId
  });

  await Activity.create({
    tenantId: lead.tenantId,
    leadId: lead._id,
    customerId: lead.customerId,
    type: 'assigned',
    channel: 'system',
    actorUserId,
    actorLabel: actorUserId ? 'user' : 'routing',
    content: `Assigned (${usedMode}): ${reason || 'n/a'}`,
    metadata: {
      to_user_id: targetUserId ? targetUserId.toString() : null,
      to_branch_id: targetBranchId ? targetBranchId.toString() : null
    }
  });

  await writeAudit({
    tenantId: lead.tenantId,
    actorUserId,
    actorLabel: actorUserId ? 'user' : 'routing',
    action: 'lead.assign',
    objectType: 'lead',
    objectId: lead._id.toString(),
    after: { to_user_id: targetUserId, mode: usedMode, reason }
  });

  return { lead, assignment };
}

module.exports = { routeLead };
