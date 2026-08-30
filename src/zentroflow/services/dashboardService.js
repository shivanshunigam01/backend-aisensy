const { Lead, FollowUp, Job, Integration } = require('../models');

async function getDashboard(tenantId, { from, to } = {}) {
  const match = { tenantId, deleted: false };
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  const [
    total,
    byStage,
    byTemp,
    byVerification,
    byQualification,
    overdueCount,
    followupsDue,
    newLeads,
    jobsFailed,
    integrations
  ] = await Promise.all([
    Lead.countDocuments(match),
    Lead.aggregate([{ $match: match }, { $group: { _id: '$currentStage', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: match }, { $group: { _id: '$temperature', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: match }, { $group: { _id: '$verificationStatus', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: match }, { $group: { _id: '$qualificationStatus', count: { $sum: 1 } } }]),
    Lead.countDocuments({ ...match, overdue: true }),
    FollowUp.countDocuments({
      tenantId,
      status: { $in: ['open', 'overdue'] },
      dueAt: { $lte: new Date(Date.now() + 86400000) }
    }),
    Lead.countDocuments({
      ...match,
      createdAt: { $gte: new Date(Date.now() - 7 * 86400000) }
    }),
    Job.countDocuments({ tenantId, status: { $in: ['failed', 'dead'] } }),
    Integration.find({ tenantId }).limit(20)
  ]);

  const mapCounts = (rows) => Object.fromEntries(rows.map((r) => [r._id || 'unknown', r.count]));

  return {
    total,
    new_this_week: newLeads,
    overdue_followups: overdueCount,
    followups_due: followupsDue,
    jobs_failed: jobsFailed,
    by_stage: mapCounts(byStage),
    by_temperature: mapCounts(byTemp),
    by_verification: mapCounts(byVerification),
    by_qualification: mapCounts(byQualification),
    integrations: integrations.map(Integration.toPublic),
    widgets: [
      { key: 'new', label: 'New Leads', count: byStage.find((s) => s._id === 'new' || s._id === 'valid')?.count || newLeads, filter: { stage: 'valid' } },
      { key: 'qualified', label: 'Verified / Qualified', count: mapCounts(byQualification).qualified || 0, filter: { qualification_status: 'qualified' } },
      { key: 'hot', label: 'Hot', count: mapCounts(byTemp).hot || 0, filter: { temperature: 'hot' } },
      { key: 'warm', label: 'Warm', count: mapCounts(byTemp).warm || 0, filter: { temperature: 'warm' } },
      { key: 'cold', label: 'Cold', count: mapCounts(byTemp).cold || 0, filter: { temperature: 'cold' } },
      { key: 'followups_due', label: 'Follow-ups Due', count: followupsDue, filter: {} },
      { key: 'overdue', label: 'Overdue Follow-ups', count: overdueCount, filter: { overdue: true } },
      { key: 'appointment', label: 'Appointments', count: mapCounts(byStage).appointment || 0, filter: { stage: 'appointment' } },
      { key: 'sale', label: 'Bookings / Sales', count: (mapCounts(byStage).booking || 0) + (mapCounts(byStage).sale || 0), filter: { stage: 'sale' } },
      { key: 'lost', label: 'Lost', count: mapCounts(byStage).lost || 0, filter: { stage: 'lost' } }
    ]
  };
}

async function getPlatformOverview() {
  const { Tenant, User } = require('../models');
  const [tenants, leads, users, failedJobs] = await Promise.all([
    Tenant.countDocuments(),
    Lead.countDocuments({ deleted: false }),
    User.countDocuments({ status: 'active' }),
    Job.countDocuments({ status: { $in: ['failed', 'dead'] } })
  ]);
  const recentTenants = await Tenant.find().sort({ createdAt: -1 }).limit(10);
  return {
    tenants,
    leads,
    users,
    failed_jobs: failedJobs,
    recent_tenants: recentTenants.map(Tenant.toPublic)
  };
}

module.exports = { getDashboard, getPlatformOverview };
