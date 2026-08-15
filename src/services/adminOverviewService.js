const Lead = require('../models/Lead');
const BajajAsdApplication = require('../models/BajajAsdApplication');
const ReferralSubmission = require('../models/ReferralSubmission');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Cms = require('../models/Cms');

const GROWTH_FORM_TYPES = ['growth-tool', 'ai-assistant', 'calculator', 'audit'];

async function getOverview() {
  const [
    leadTotal,
    leadByStatus,
    leadByFormType,
    bajajAsdTotal,
    growthHubTotal,
    pulsarTotal,
    customerTotal,
    invoiceByStatus,
    cmsDoc
  ] = await Promise.all([
    Lead.countDocuments(),
    Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $group: { _id: '$form_type', count: { $sum: 1 } } }]),
    BajajAsdApplication.countDocuments(),
    Lead.countDocuments({
      $or: [{ form_type: { $in: GROWTH_FORM_TYPES } }, { tool_id: { $ne: null } }, { source: /^growth-hub/i }]
    }),
    ReferralSubmission.countDocuments(),
    Customer.countDocuments(),
    Invoice.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Cms.findOne({ key: 'main' })
  ]);

  const statusMap = (rows) =>
    rows.reduce((acc, r) => {
      acc[r._id || 'unknown'] = r.count;
      return acc;
    }, {});

  const paidInvoices = await Invoice.find({ status: 'paid' });
  const revenue = paidInvoices.reduce((sum, inv) => {
    const sub = (inv.items || []).reduce((s, it) => s + (it.qty || 0) * (it.rate || 0), 0);
    return sum + sub * (1 + (inv.gstPercent || 0) / 100);
  }, 0);

  return {
    modules: {
      leads: { total: leadTotal, by_status: statusMap(leadByStatus), by_form_type: statusMap(leadByFormType) },
      bajaj_asd: { total: bajajAsdTotal },
      growth_hub: { total: growthHubTotal },
      pulsar: { total: pulsarTotal },
      customers: { total: customerTotal },
      invoices: { total: invoiceByStatus.reduce((s, r) => s + r.count, 0), by_status: statusMap(invoiceByStatus), revenue_paid: Math.round(revenue) },
      cms: {
        updated_at: cmsDoc?.updatedAt?.toISOString() ?? null,
        works: cmsDoc?.works?.length ?? 0,
        case_studies: cmsDoc?.caseStudies?.length ?? 0,
        testimonials: cmsDoc?.testimonials?.length ?? 0,
        gallery: cmsDoc?.gallery?.length ?? 0
      }
    },
    generated_at: new Date().toISOString()
  };
}

module.exports = { getOverview };
