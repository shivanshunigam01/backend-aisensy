const express = require('express');
const { requireMongo } = require('../middleware/requireMongo');
const { requireAdmin } = require('../middleware/requireAdmin');
const bajajAsdController = require('../controllers/bajajAsdController');

const router = express.Router();

router.post('/bajaj-asd/apply', requireMongo, bajajAsdController.postApply);
router.get('/bajaj-asd/applications', requireMongo, requireAdmin, bajajAsdController.getApplications);
router.post('/bajaj-asd/update', requireMongo, requireAdmin, bajajAsdController.postUpdateApplication);

module.exports = router;
