const adminOverviewService = require('../services/adminOverviewService');

async function getOverview(req, res, next) {
  try {
    const overview = await adminOverviewService.getOverview();
    return res.json({ overview });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getOverview };
