const express = require('express');
const paymentRoutes = require('./paymentRoutes');
const authRoutes = require('./authRoutes');
const leadsRoutes = require('./leadsRoutes');
const bajajAsdRoutes = require('./bajajAsdRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use(paymentRoutes);
router.use(leadsRoutes);
router.use(bajajAsdRoutes);

module.exports = router;
