const express = require('express');
const { requireMongo } = require('../middleware/requireMongo');
const { requireAdmin } = require('../middleware/requireAdmin');
const leadsController = require('../controllers/leadsController');

const router = express.Router();

router.post('/leads', requireMongo, leadsController.postLead);
router.get('/leads', requireMongo, requireAdmin, leadsController.getLeads);
router.post('/leads/update', requireMongo, requireAdmin, leadsController.postUpdateLead);
router.post('/leads/delete', requireMongo, requireAdmin, leadsController.postDeleteLead);

module.exports = router;
