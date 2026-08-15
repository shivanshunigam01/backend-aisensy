const express = require('express');
const { requireMongo } = require('../middleware/requireMongo');
const { requireAdmin } = require('../middleware/requireAdmin');
const adminOverviewController = require('../controllers/adminOverviewController');

const router = express.Router();

router.get('/overview', requireMongo, requireAdmin, adminOverviewController.getOverview);

module.exports = router;
