const express = require('express');
const paymentRoutes = require('./paymentRoutes');
const authRoutes = require('./authRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use(paymentRoutes);

module.exports = router;
