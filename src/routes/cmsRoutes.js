const express = require('express');
const { requireMongo } = require('../middleware/requireMongo');
const { requireAdmin } = require('../middleware/requireAdmin');
const cmsController = require('../controllers/cmsController');

const router = express.Router();

router.get('/', requireMongo, cmsController.getCms);
router.put('/', requireMongo, requireAdmin, cmsController.putCms);
router.get('/sections/:section', requireMongo, cmsController.getSection);
router.put('/sections/:section', requireMongo, requireAdmin, cmsController.putSection);

module.exports = router;
