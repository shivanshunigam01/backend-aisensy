const cmsService = require('../services/cmsService');

async function getCms(req, res, next) {
  try {
    const cms = await cmsService.getFullCms();
    return res.json({ cms });
  } catch (err) {
    return next(err);
  }
}

async function putCms(req, res, next) {
  try {
    const cms = await cmsService.saveFullCms(req.body);
    return res.json({ ok: true, cms });
  } catch (err) {
    return next(err);
  }
}

async function getSection(req, res, next) {
  try {
    const data = await cmsService.getSection(req.params.section);
    if (!data) return res.status(404).json({ error: 'Unknown CMS section.' });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

async function putSection(req, res, next) {
  try {
    const cms = await cmsService.saveSection(req.params.section, req.body);
    if (!cms) return res.status(404).json({ error: 'Unknown CMS section.' });
    return res.json({ ok: true, cms });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getCms, putCms, getSection, putSection };
