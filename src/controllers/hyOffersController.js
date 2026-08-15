const hyOffersService = require('../services/hyOffersService');

async function postReferral(req, res, next) {
  try {
    const result = await hyOffersService.submitReferral(req.body);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

async function postTrackClick(req, res, next) {
  try {
    const result = await hyOffersService.trackClick(req.body);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function getReferrals(req, res, next) {
  try {
    return res.json({ referrals: await hyOffersService.listReferrals() });
  } catch (err) {
    return next(err);
  }
}

async function postUpdateReferral(req, res, next) {
  try {
    const referral = await hyOffersService.updateReferral(req.body.id, req.body);
    if (!referral) return res.status(404).json({ error: 'Referral not found.' });
    return res.json({ referral });
  } catch (err) {
    return next(err);
  }
}

async function getCustomers(req, res, next) {
  try {
    const branch = req.query.branch ? String(req.query.branch) : '';
    return res.json({ customers: await hyOffersService.listCustomers(branch) });
  } catch (err) {
    return next(err);
  }
}

async function postImportCustomers(req, res, next) {
  try {
    const result = await hyOffersService.importCustomers(req.body.customers, req.body.branch);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function getCustomerByCode(req, res, next) {
  try {
    const customer = await hyOffersService.lookupCustomerByCode(req.params.code);
    if (!customer) return res.status(404).json({ error: 'Referral code not found.' });
    return res.json({ customer });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  postReferral,
  postTrackClick,
  getReferrals,
  postUpdateReferral,
  getCustomers,
  postImportCustomers,
  getCustomerByCode
};
