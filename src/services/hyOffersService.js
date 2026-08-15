const ReferralSubmission = require('../models/ReferralSubmission');
const HyOfferCustomer = require('../models/HyOfferCustomer');

async function submitReferral(body) {
  const payload = {
    referrerCode: String(body.referrerCode ?? '').trim(),
    referrerName: String(body.referrerName ?? '').trim(),
    referrerMobile: String(body.referrerMobile ?? '').trim(),
    friendName: String(body.friendName ?? '').trim(),
    friendMobile: String(body.friendMobile ?? '').trim(),
    friendEmail: String(body.friendEmail ?? '').trim(),
    referrerOffer: Number(body.referrerOffer) || 500,
    friendOffer: Number(body.friendOffer) || 500,
    branch: String(body.branch ?? '').trim()
  };

  if (!payload.referrerCode || !payload.friendName || !payload.friendMobile) {
    return { ok: false, status: 400, error: 'Referrer code, friend name and mobile are required.' };
  }

  const doc = await ReferralSubmission.create(payload);

  await HyOfferCustomer.findOneAndUpdate(
    { referralCode: payload.referrerCode },
    { formSubmitted: true, submittedAt: new Date().toISOString() },
    { new: true }
  );

  return { ok: true, submission: ReferralSubmission.toPublic(doc) };
}

async function trackClick(body) {
  const code = String(body.referrerCode ?? body.code ?? '').trim();
  if (!code) return { ok: false, status: 400, error: 'referrerCode is required.' };

  await HyOfferCustomer.findOneAndUpdate(
    { referralCode: code },
    { linkClicked: true, clickedAt: new Date().toISOString() },
    { new: true }
  );

  return { ok: true };
}

async function listReferrals() {
  const docs = await ReferralSubmission.find().sort({ createdAt: -1 }).limit(2000);
  return docs.map(ReferralSubmission.toPublic);
}

async function updateReferral(id, patch) {
  const doc = await ReferralSubmission.findById(id);
  if (!doc) return null;
  if (patch.status) doc.status = patch.status;
  if (patch.admin_notes !== undefined) doc.admin_notes = patch.admin_notes;
  await doc.save();
  return ReferralSubmission.toPublic(doc);
}

async function listCustomers(branch) {
  const q = branch ? { branch } : {};
  const docs = await HyOfferCustomer.find(q).sort({ createdAt: -1 }).limit(5000);
  return docs.map(HyOfferCustomer.toPublic);
}

async function importCustomers(customers, branch) {
  if (!Array.isArray(customers)) return { ok: false, error: 'customers array required' };
  let imported = 0;
  for (const c of customers) {
    await HyOfferCustomer.findOneAndUpdate(
      { referralCode: c.referralCode },
      {
        externalId: c.id,
        branch: branch || c.branch || '',
        customerName: c.customerName,
        mobileNo: c.mobileNo,
        dealerName: c.dealerName || '',
        referralCode: c.referralCode,
        referralLink: c.referralLink || '',
        deliveryStatus: c.deliveryStatus || 'pending',
        linkClicked: c.linkClicked || false,
        formSubmitted: c.formSubmitted || false
      },
      { upsert: true, new: true }
    );
    imported += 1;
  }
  return { ok: true, imported };
}

async function lookupCustomerByCode(code) {
  const doc = await HyOfferCustomer.findOne({ referralCode: code });
  return doc ? HyOfferCustomer.toPublic(doc) : null;
}

module.exports = {
  submitReferral,
  trackClick,
  listReferrals,
  updateReferral,
  listCustomers,
  importCustomers,
  lookupCustomerByCode
};
