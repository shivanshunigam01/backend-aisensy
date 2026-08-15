const express = require('express');
const { requireMongo } = require('../middleware/requireMongo');
const { requireAdmin } = require('../middleware/requireAdmin');
const crmController = require('../controllers/crmController');

const router = express.Router();

router.use(requireMongo, requireAdmin);

router.get('/customers', crmController.getCustomers);
router.post('/customers', crmController.postCustomer);
router.put('/customers/:id', crmController.putCustomer);
router.delete('/customers/:id', crmController.deleteCustomer);

router.get('/quotations', crmController.getQuotations);
router.post('/quotations', crmController.postQuotation);
router.put('/quotations/:id', crmController.putQuotation);
router.delete('/quotations/:id', crmController.deleteQuotation);
router.post('/quotations/convert-to-invoice', crmController.convertQuotation);

router.get('/invoices', crmController.getInvoices);
router.post('/invoices', crmController.postInvoice);
router.put('/invoices/:id', crmController.putInvoice);
router.delete('/invoices/:id', crmController.deleteInvoice);
router.post('/invoices/mark-paid', crmController.markPaid);

router.get('/receipts', crmController.getReceipts);

router.get('/settings', crmController.getSettings);
router.put('/settings', crmController.putSettings);

router.post('/import', crmController.bulkImport);

module.exports = router;
