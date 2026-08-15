const express = require('express');
const { requireMongo } = require('../middleware/requireMongo');
const { requireAdmin } = require('../middleware/requireAdmin');
const hyOffersController = require('../controllers/hyOffersController');

const router = express.Router();

router.post('/referrals', requireMongo, hyOffersController.postReferral);
router.post('/track-click', requireMongo, hyOffersController.postTrackClick);
router.get('/referrals/lookup/:code', requireMongo, hyOffersController.getCustomerByCode);

router.get('/referrals', requireMongo, requireAdmin, hyOffersController.getReferrals);
router.post('/referrals/update', requireMongo, requireAdmin, hyOffersController.postUpdateReferral);
router.get('/customers', requireMongo, requireAdmin, hyOffersController.getCustomers);
router.post('/customers/import', requireMongo, requireAdmin, hyOffersController.postImportCustomers);

module.exports = router;
