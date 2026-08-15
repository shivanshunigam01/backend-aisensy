const bajajAsdService = require('../services/bajajAsdService');

async function postApply(req, res, next) {
  try {
    const result = await bajajAsdService.submitApplication(req.body ?? {});
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(201).json({ ok: true, application: result.application });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        error: 'An application with this mobile number already exists for this location.'
      });
    }
    return next(err);
  }
}

async function getApplications(_req, res, next) {
  try {
    const result = await bajajAsdService.listApplications();
    return res.status(200).json({ applications: result.applications });
  } catch (err) {
    return next(err);
  }
}

async function postUpdateApplication(req, res, next) {
  try {
    const { id, ...patch } = req.body ?? {};
    const result = await bajajAsdService.updateApplication(id, patch);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(200).json({ application: result.application });
  } catch (err) {
    return next(err);
  }
}

module.exports = { postApply, getApplications, postUpdateApplication };
