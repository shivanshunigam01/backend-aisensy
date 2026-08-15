const Lead = require('../models/Lead');

function normalizePhone(raw) {
  return String(raw ?? '')
    .replace(/\D/g, '')
    .slice(-10);
}

async function createLead(body) {
  const name = String(body.name ?? '').trim();
  const phone = normalizePhone(body.phone);

  if (!name) return { ok: false, status: 400, error: 'Name is required.' };
  if (phone.length !== 10) return { ok: false, status: 400, error: 'Valid 10-digit phone is required.' };

  const doc = await Lead.create({
    name,
    phone,
    email: String(body.email ?? '').trim(),
    city: body.city ?? null,
    business_type: body.business_type ?? null,
    product_interest: body.product_interest ?? null,
    message: body.message ?? null,
    form_type: body.form_type ?? null,
    audit_type: body.audit_type ?? null,
    calculator_type: body.calculator_type ?? null,
    company_name: body.company_name ?? null,
    tool_id: body.tool_id ?? null,
    score: typeof body.score === 'number' ? body.score : body.score != null ? Number(body.score) : null,
    report_summary: body.report_summary ?? null,
    report_data: typeof body.report_data === 'string' ? body.report_data : body.report_data ? JSON.stringify(body.report_data) : null,
    source: body.source ?? 'website',
    bajaj_asd_application_id: body.bajaj_asd_application_id ?? null
  });

  return { ok: true, lead: Lead.toPublic(doc) };
}

async function listLeads() {
  const docs = await Lead.find().sort({ createdAt: -1 }).limit(2000);
  return { ok: true, leads: docs.map(Lead.toPublic) };
}

async function updateLead(id, patch) {
  if (!id) return { ok: false, status: 400, error: 'id is required.' };

  const allowed = {};
  if (patch.status) allowed.status = patch.status;
  if (patch.admin_notes !== undefined) allowed.admin_notes = patch.admin_notes;

  const doc = await Lead.findByIdAndUpdate(id, allowed, { new: true, runValidators: true });
  if (!doc) return { ok: false, status: 404, error: 'Lead not found.' };

  return { ok: true, lead: Lead.toPublic(doc) };
}

async function deleteLead(id) {
  if (!id) return { ok: false, status: 400, error: 'id is required.' };

  const doc = await Lead.findByIdAndDelete(id);
  if (!doc) return { ok: false, status: 404, error: 'Lead not found.' };

  return { ok: true };
}

module.exports = {
  createLead,
  listLeads,
  updateLead,
  deleteLead,
  normalizePhone
};
