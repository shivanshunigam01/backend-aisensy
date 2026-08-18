const express = require('express');
const { requireMongo } = require('../middleware/requireMongo');
const { requireAdmin } = require('../middleware/requireAdmin');
const planController = require('../controllers/planController');

const router = express.Router();

function requireAdminIfIncludeInactive(req, res, next) {
  const raw = req.query?.includeInactive;
  const includeInactive = raw === '1' || raw === 'true';
  if (!includeInactive) return next();
  return requireAdmin(req, res, next);
}

router.get('/', requireMongo, requireAdminIfIncludeInactive, planController.listPlans);
router.put('/catalog', requireMongo, requireAdmin, planController.replaceCatalog);
router.put('/trial', requireMongo, requireAdmin, planController.saveTrial);
router.post('/trial/start', requireMongo, planController.startTrial);
router.post('/trial', requireMongo, planController.startTrial);
router.post('/', requireMongo, requireAdmin, planController.upsertPlan);
router.get('/:id', requireMongo, planController.getPlan);
router.put('/:id', requireMongo, requireAdmin, planController.replacePlan);
router.delete('/:id', requireMongo, requireAdmin, planController.deletePlan);

module.exports = router;
