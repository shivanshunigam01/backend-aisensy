const BajajAsdApplication = require('../models/BajajAsdApplication');
const Lead = require('../models/Lead');
const { CONSENT_POLICY_VERSION, formatLocationSummary, validateLocationSelection } = require('../constants/bajajAsdMasters');
const { normalizePhone } = require('./leadsService');

const AUTOMOTIVE_BUSINESS_TYPES = new Set([
  'Two-Wheeler Dealer',
  'Auto Parts / Spares',
  'Tyre Dealer',
  'Battery Dealer',
  'Tractor / Agri Equipment',
  'EV / E-Rickshaw',
  'Automobile Workshop'
]);

function isValidMobile(raw) {
  const m = normalizePhone(raw);
  return /^[6-9]\d{9}$/.test(m);
}

function isValidEmail(raw) {
  if (!String(raw ?? '').trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(raw).trim());
}

function normalizePan(raw) {
  return String(raw ?? '').replace(/\s/g, '').toUpperCase();
}

function normalizeGst(raw) {
  return String(raw ?? '').replace(/\s/g, '').toUpperCase();
}

function isValidPan(raw) {
  if (!String(raw ?? '').trim()) return true;
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalizePan(raw));
}

function isValidGst(raw) {
  if (!String(raw ?? '').trim()) return true;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(normalizeGst(raw));
}

function computeLeadScore(form) {
  let score = 0;

  if (AUTOMOTIVE_BUSINESS_TYPES.has(form.business_type)) score += 15;
  else if (form.business_type && form.business_type !== 'New Entrepreneur') score += 8;

  const yearsScore = {
    'Less than 1 year': 4,
    '1–3 years': 6,
    '3–5 years': 8,
    '5–10 years': 10,
    'More than 10 years': 10
  };
  if (form.years_in_business) score += yearsScore[form.years_in_business] ?? 0;

  const investScore = {
    'Below ₹5 Lakh': 8,
    '₹5–10 Lakh': 12,
    '₹10–15 Lakh': 18,
    '₹15–25 Lakh': 22,
    'Above ₹25 Lakh': 25
  };
  if (form.investment_capacity) score += investScore[form.investment_capacity] ?? 0;

  const spaceScore = {
    'Own space available': 20,
    'Rented space available': 16,
    'Can arrange suitable space': 12,
    'Currently not available': 4
  };
  if (form.space_status) score += spaceScore[form.space_status] ?? 0;

  if (form.showroom_space && form.showroom_space !== 'Not sure') score += 3;
  if (form.workshop_space && form.workshop_space !== 'Not sure') score += 3;
  if (form.frontage && form.frontage !== 'Not sure') score += 4;

  const timelineScore = {
    Immediately: 20,
    'Within 1 Month': 16,
    '1–3 Months': 12,
    '3–6 Months': 8,
    'More than 6 Months': 4
  };
  if (form.start_timeline) score += timelineScore[form.start_timeline] ?? 0;

  return score;
}

function validateApplication(body) {
  const districts = Array.isArray(body.districts) ? body.districts.map(String) : [];
  const locations = Array.isArray(body.locations) ? body.locations.map(String) : [];
  const locationCheck = validateLocationSelection(body.state, districts, locations);
  if (!locationCheck.ok) {
    return { ok: false, status: 400, error: locationCheck.error };
  }

  const name = String(body.applicant_name ?? '').trim();
  if (name.length < 2 || name.length > 80) {
    return { ok: false, status: 400, error: 'Applicant name must be 2–80 characters.' };
  }

  if (!isValidMobile(body.mobile)) {
    return { ok: false, status: 400, error: 'Enter a valid 10-digit mobile number.' };
  }

  const altMobile = String(body.alternate_mobile ?? '').trim();
  if (altMobile) {
    if (!isValidMobile(altMobile)) {
      return { ok: false, status: 400, error: 'Alternate mobile number is not valid.' };
    }
    if (normalizePhone(altMobile) === normalizePhone(body.mobile)) {
      return { ok: false, status: 400, error: 'Alternate number must differ from primary mobile.' };
    }
  }

  if (!isValidEmail(body.email)) {
    return { ok: false, status: 400, error: 'Enter a valid email address.' };
  }

  const town = String(body.current_town ?? '').trim();
  if (town.length < 2 || town.length > 100) {
    return { ok: false, status: 400, error: 'Current town must be 2–100 characters.' };
  }

  if (!body.is_existing_business) {
    return { ok: false, status: 400, error: 'Please indicate whether you run a business today.' };
  }

  const existing = body.is_existing_business === 'Yes';

  if (existing) {
    const bn = String(body.business_name ?? '').trim();
    if (bn.length < 2 || bn.length > 120) {
      return { ok: false, status: 400, error: 'Business / firm name must be 2–120 characters.' };
    }
    if (!body.years_in_business) {
      return { ok: false, status: 400, error: 'Select years in business.' };
    }
  }

  if (!body.business_type) {
    return { ok: false, status: 400, error: 'Select a business type.' };
  }

  if (body.business_type === 'Other Existing Business') {
    const other = String(body.other_business_type ?? '').trim();
    if (other.length < 2 || other.length > 100) {
      return { ok: false, status: 400, error: 'Other business type must be 2–100 characters.' };
    }
  }

  if (!body.existing_oem) {
    return { ok: false, status: 400, error: 'Please indicate OEM / EV brand association.' };
  }

  if (body.existing_oem === 'Yes') {
    const brand = String(body.oem_brand ?? '').trim();
    if (brand.length < 2 || brand.length > 100) {
      return { ok: false, status: 400, error: 'Brand name must be 2–100 characters.' };
    }
  }

  if (!isValidPan(body.pan)) {
    return { ok: false, status: 400, error: 'Enter a valid PAN (e.g. ABCDE1234F).' };
  }
  if (!isValidGst(body.gst_number)) {
    return { ok: false, status: 400, error: 'Enter a valid 15-character GST number.' };
  }

  if (!body.investment_capacity) {
    return { ok: false, status: 400, error: 'Select investment capacity.' };
  }
  if (!body.space_status) {
    return { ok: false, status: 400, error: 'Select commercial space availability.' };
  }
  if (!body.showroom_space) {
    return { ok: false, status: 400, error: 'Select showroom space.' };
  }
  if (!body.workshop_space) {
    return { ok: false, status: 400, error: 'Select workshop space.' };
  }
  if (!body.frontage) {
    return { ok: false, status: 400, error: 'Select frontage.' };
  }
  if (!body.start_timeline) {
    return { ok: false, status: 400, error: 'Select when you can start.' };
  }

  if (String(body.applicant_remarks ?? '').trim().length > 500) {
    return { ok: false, status: 400, error: 'Additional remarks must be at most 500 characters.' };
  }

  if (!body.contact_consent) {
    return { ok: false, status: 400, error: 'Contact consent is required.' };
  }
  if (!body.disclaimer_ack) {
    return { ok: false, status: 400, error: 'Disclaimer acknowledgement is required.' };
  }

  return { ok: true, districts, locations };
}

function buildPayload(body, districts, locations) {
  const mobile = normalizePhone(body.mobile);
  const alternate_mobile = String(body.alternate_mobile ?? '').trim()
    ? normalizePhone(body.alternate_mobile)
    : '';

  const payload = {
    state: body.state,
    districts,
    locations,
    target_location: locations.join(','),
    target_location_label: formatLocationSummary(body.state, districts, locations),
    district: districts.join(', '),
    applicant_name: String(body.applicant_name).trim(),
    mobile,
    alternate_mobile,
    email: String(body.email ?? '').trim(),
    current_town: String(body.current_town).trim(),
    pan: normalizePan(body.pan),
    gst_number: normalizeGst(body.gst_number),
    is_existing_business: body.is_existing_business,
    business_name: String(body.business_name ?? '').trim(),
    business_type:
      body.is_existing_business === 'No' ? 'New Entrepreneur' : body.business_type,
    other_business_type: String(body.other_business_type ?? '').trim(),
    years_in_business: String(body.years_in_business ?? '').trim(),
    existing_oem: body.existing_oem,
    oem_brand: String(body.oem_brand ?? '').trim(),
    investment_capacity: body.investment_capacity,
    space_status: body.space_status,
    showroom_space: String(body.showroom_space ?? '').trim(),
    workshop_space: String(body.workshop_space ?? '').trim(),
    space_size: `Showroom: ${String(body.showroom_space ?? '').trim()} · Workshop: ${String(body.workshop_space ?? '').trim()}`,
    frontage: String(body.frontage ?? '').trim(),
    start_timeline: body.start_timeline,
    applicant_remarks: String(body.applicant_remarks ?? '').trim(),
    contact_consent: body.contact_consent === true,
    disclaimer_ack: body.disclaimer_ack === true,
    consent_policy_version: CONSENT_POLICY_VERSION,
    consent_at: new Date(),
    lead_score: computeLeadScore(body)
  };

  return payload;
}

async function submitApplication(body) {
  const validation = validateApplication(body);
  if (!validation.ok) return validation;

  const payload = buildPayload(body, validation.districts, validation.locations);

  const duplicate = await BajajAsdApplication.findOne({
    mobile: payload.mobile,
    state: payload.state
  });
  if (duplicate) {
    return {
      ok: false,
      status: 409,
      error: 'An application with this mobile number already exists for this state.'
    };
  }

  const application = await BajajAsdApplication.create(payload);

  const summary = [
    `ASD: ${payload.target_location_label}`,
    `District: ${payload.district}`,
    `Investment: ${payload.investment_capacity}`,
    `Score: ${payload.lead_score}`
  ].join(' · ');

  const publicApp = BajajAsdApplication.toPublic(application);

  const leadDoc = await Lead.create({
    name: payload.applicant_name,
    phone: payload.mobile,
    email: payload.email || '',
    city: payload.current_town,
    business_type: payload.business_type,
    product_interest: payload.target_location_label,
    company_name: payload.business_name || null,
    source: 'bajaj_asd',
    form_type: 'bajaj_asd',
    message: payload.applicant_remarks || null,
    score: payload.lead_score,
    report_summary: summary,
    report_data: JSON.stringify(publicApp),
    bajaj_asd_application_id: application._id
  });

  application.lead_id = leadDoc._id;
  await application.save();

  return {
    ok: true,
    application: {
      ...publicApp,
      lead_id: leadDoc._id.toString()
    }
  };
}

async function listApplications() {
  const docs = await BajajAsdApplication.find().sort({ createdAt: -1 }).limit(2000);
  return { ok: true, applications: docs.map(BajajAsdApplication.toPublic) };
}

async function updateApplication(id, patch) {
  if (!id) return { ok: false, status: 400, error: 'id is required.' };

  const allowed = {};
  if (patch.status) allowed.status = patch.status;
  if (patch.admin_notes !== undefined) allowed.admin_notes = patch.admin_notes;

  const doc = await BajajAsdApplication.findByIdAndUpdate(id, allowed, {
    new: true,
    runValidators: true
  });
  if (!doc) return { ok: false, status: 404, error: 'Application not found.' };

  if (doc.lead_id && (patch.status || patch.admin_notes !== undefined)) {
    const leadPatch = {};
    if (patch.status) leadPatch.status = patch.status;
    if (patch.admin_notes !== undefined) leadPatch.admin_notes = patch.admin_notes;
    await Lead.findByIdAndUpdate(doc.lead_id, leadPatch);
  }

  return { ok: true, application: BajajAsdApplication.toPublic(doc) };
}

module.exports = {
  submitApplication,
  listApplications,
  updateApplication,
  validateApplication,
  computeLeadScore
};
