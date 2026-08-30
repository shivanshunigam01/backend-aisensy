const express = require('express');
const { correlationId } = require('../middleware/correlationId');
const { requireZfAuth, requireRoles, resolveTenantScope, requireTenant } = require('../middleware/auth');
const { requireMongo } = require('../../middleware/requireMongo');
const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');
const crmController = require('../controllers/crmController');

const router = express.Router();

router.use(correlationId);

// --- Public / webhook (no ZFauth) ---
router.get('/webhooks/meta', crmController.metaVerify);
router.post('/webhooks/meta', requireMongo, crmController.metaWebhook);

// Public ingest with tenant_key (API channel) — optional auth via Idempotency-Key
router.post('/v1/leads/ingest', requireMongo, crmController.ingest);

// Auth
router.post('/auth/login', requireMongo, authController.postLogin);

// Authenticated surface
router.use(requireMongo, requireZfAuth);

router.get('/auth/me', authController.getMe);
router.post('/jobs/process', requireRoles('super_admin', 'ops_verifier'), crmController.processJobs);

// Platform super-admin
router.get('/platform/overview', requireRoles('super_admin'), adminController.platformOverview);
router.get('/tenants', requireRoles('super_admin', 'ops_verifier'), adminController.listTenants);
router.post('/tenants', requireRoles('super_admin'), adminController.createTenant);
router.get('/tenants/:id', requireRoles('super_admin', 'ops_verifier'), adminController.getTenant);
router.patch('/tenants/:id', requireRoles('super_admin'), adminController.updateTenant);

// Tenant-scoped CRM
router.use(resolveTenantScope);

router.get('/dashboard', requireTenant, crmController.dashboard);

router.get('/leads', requireTenant, crmController.listLeads);
router.get('/leads/export', requireTenant, requireRoles('super_admin', 'ops_verifier', 'client_admin', 'client_manager'), crmController.exportLeads);
router.get('/leads/:id', requireTenant, crmController.getLead);
router.post('/leads/:id/stage', requireTenant, crmController.changeStage);
router.post('/leads/:id/remarks', requireTenant, crmController.addRemark);
router.post('/leads/:id/followups', requireTenant, crmController.createFollowUp);
router.post('/leads/:id/assign', requireTenant, requireRoles('super_admin', 'ops_verifier', 'client_admin', 'client_manager'), crmController.assign);
router.post('/leads/:id/verify', requireTenant, requireRoles('super_admin', 'ops_verifier'), crmController.verify);
router.post('/followups/:followUpId/complete', requireTenant, crmController.completeFollowUp);

router.get('/branches', requireTenant, adminController.listBranches);
router.post('/branches', requireTenant, requireRoles('super_admin', 'client_admin'), adminController.createBranch);

router.get('/users', requireTenant, requireRoles('super_admin', 'ops_verifier', 'client_admin', 'client_manager'), adminController.listUsers);
router.post('/users', requireTenant, requireRoles('super_admin', 'client_admin'), adminController.createUser);

router.get('/products', requireTenant, adminController.listProducts);
router.post('/products', requireTenant, requireRoles('super_admin', 'client_admin'), adminController.createProduct);

router.get('/integrations', requireTenant, requireRoles('super_admin', 'ops_verifier', 'client_admin'), adminController.listIntegrations);
router.post('/integrations', requireTenant, requireRoles('super_admin', 'ops_verifier', 'client_admin'), adminController.upsertIntegration);

router.get('/automations', requireTenant, requireRoles('super_admin', 'ops_verifier', 'client_admin'), adminController.listAutomations);
router.post('/automations', requireTenant, requireRoles('super_admin', 'client_admin'), adminController.upsertAutomation);

router.get('/jobs', requireRoles('super_admin', 'ops_verifier', 'client_admin'), crmController.listJobs);
router.post('/jobs/:id/retry', requireRoles('super_admin', 'ops_verifier'), crmController.retryJob);

router.get('/capi/events', requireTenant, requireRoles('super_admin', 'ops_verifier', 'client_admin'), crmController.listCapi);

router.get('/audit', requireRoles('super_admin', 'ops_verifier', 'client_admin', 'auditor'), adminController.listAudit);

module.exports = router;
