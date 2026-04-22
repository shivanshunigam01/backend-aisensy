const express = require('express');
const { requireMongo } = require('../middleware/requireMongo');
const authController = require('../controllers/authController');

const router = express.Router();

router.get('/exists', requireMongo, authController.getExists);
router.get('/profile', requireMongo, authController.getProfile);
router.post('/register', requireMongo, authController.postRegister);
router.post('/login', requireMongo, authController.postLogin);

module.exports = router;
