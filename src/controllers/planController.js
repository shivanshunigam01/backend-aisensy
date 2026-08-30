const planService = require('../services/planService');

function wantsInactive(query) {
  const raw = query?.includeInactive;
  return raw === '1' || raw === 'true';
}

async function listPlans(req, res, next) {
  try {
    const catalog = await planService.getCatalog({ includeInactive: wantsInactive(req.query) ? true : undefined });
    return res.status(200).json(catalog);
  } catch (err) {
    return next(err);
  }
}

async function getPlan(req, res, next) {
  try {
    const plan = await planService.getPlan(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Plan not found.' });
    return res.status(200).json({ plan });
  } catch (err) {
    return next(err);
  }
}

async function replaceCatalog(req, res, next) {
  try {
    const result = await planService.replaceCatalog(req.body ?? {});
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(200).json({ catalog: result.catalog });
  } catch (err) {
    return next(err);
  }
}

async function saveTrial(req, res, next) {
  try {
    const trial = await planService.saveTrial(req.body ?? {});
    return res.status(200).json({ trial });
  } catch (err) {
    return next(err);
  }
}

async function upsertPlan(req, res, next) {
  try {
    const result = await planService.upsertPlan(req.body ?? {});
    return res.status(result.created ? 201 : 200).json({ plan: result.plan });
  } catch (err) {
    return next(err);
  }
}

async function replacePlan(req, res, next) {
  try {
    const plan = await planService.replacePlan(req.params.id, req.body ?? {});
    if (!plan) return res.status(404).json({ error: 'Plan not found.' });
    return res.status(200).json({ plan });
  } catch (err) {
    return next(err);
  }
}

async function deletePlan(req, res, next) {
  try {
    const id = await planService.deletePlan(req.params.id);
    if (!id) return res.status(404).json({ error: 'Plan not found.' });
    return res.status(200).json({ ok: true, id });
  } catch (err) {
    return next(err);
  }
}

async function startTrial(req, res, next) {
  try {
    const result = await planService.startTrial(req.body ?? {});
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(200).json({ ok: true, trialEndsAt: result.trialEndsAt, trial: result.trial });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listPlans,
  getPlan,
  replaceCatalog,
  saveTrial,
  upsertPlan,
  replacePlan,
  deletePlan,
  startTrial
};
