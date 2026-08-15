const express = require('express');
const { requireMongo } = require('../middleware/requireMongo');
const { requireAdmin } = require('../middleware/requireAdmin');
const adminAuthController = require('../controllers/adminAuthController');

const router = express.Router();

router.post('/login', requireMongo, adminAuthController.postLogin);
router.get('/me', requireMongo, requireAdmin, adminAuthController.getMe);

module.exports = router;
