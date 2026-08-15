const express = require('express');
const { requireAdmin } = require('../middleware/requireAdmin');
const mediaController = require('../controllers/mediaController');

const router = express.Router();

router.get('/status', requireAdmin, mediaController.getStatus);
router.post('/upload', requireAdmin, mediaController.postUpload);

module.exports = router;
