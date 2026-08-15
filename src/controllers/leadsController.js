const leadsService = require('../services/leadsService');

async function postLead(req, res, next) {
  try {
    const result = await leadsService.createLead(req.body ?? {});
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(201).json({ ok: true, lead: result.lead });
  } catch (err) {
    return next(err);
  }
}

async function getLeads(_req, res, next) {
  try {
    const result = await leadsService.listLeads();
    return res.status(200).json({ leads: result.leads });
  } catch (err) {
    return next(err);
  }
}

async function postUpdateLead(req, res, next) {
  try {
    const { id, ...patch } = req.body ?? {};
    const result = await leadsService.updateLead(id, patch);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(200).json({ lead: result.lead });
  } catch (err) {
    return next(err);
  }
}

async function postDeleteLead(req, res, next) {
  try {
    const { id } = req.body ?? {};
    const result = await leadsService.deleteLead(id);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

module.exports = { postLead, getLeads, postUpdateLead, postDeleteLead };
