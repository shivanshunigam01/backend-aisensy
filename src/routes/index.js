const express = require('express');
const paymentRoutes = require('./paymentRoutes');
const authRoutes = require('./authRoutes');
const leadsRoutes = require('./leadsRoutes');
const bajajAsdRoutes = require('./bajajAsdRoutes');
const adminAuthRoutes = require('./adminAuthRoutes');
const adminOverviewRoutes = require('./adminOverviewRoutes');
const cmsRoutes = require('./cmsRoutes');
const mediaRoutes = require('./mediaRoutes');
const crmRoutes = require('./crmRoutes');
const hyOffersRoutes = require('./hyOffersRoutes');
<<<<<<< HEAD
const zentroflowRoutes = require('../zentroflow/routes');
=======
const planRoutes = require('./planRoutes');
>>>>>>> 71f5b35d56fb9b00f78d0671fc07ac5578ac5e50

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin', adminOverviewRoutes);
router.use('/cms', cmsRoutes);
router.use('/plans', planRoutes);
router.use('/media', mediaRoutes);
router.use('/crm', crmRoutes);
router.use('/hy-offers', hyOffersRoutes);
router.use('/zentroflow', zentroflowRoutes);
router.use(paymentRoutes);
router.use(leadsRoutes);
router.use(bajajAsdRoutes);

module.exports = router;
