const crmService = require('../services/crmService');

async function getCustomers(req, res, next) {
  try {
    return res.json({ customers: await crmService.listCustomers() });
  } catch (err) {
    return next(err);
  }
}

async function postCustomer(req, res, next) {
  try {
    const customer = await crmService.createCustomer(req.body);
    return res.status(201).json({ customer });
  } catch (err) {
    return next(err);
  }
}

async function putCustomer(req, res, next) {
  try {
    const customer = await crmService.updateCustomer(req.params.id, req.body);
    if (!customer) return res.status(404).json({ error: 'Customer not found.' });
    return res.json({ customer });
  } catch (err) {
    return next(err);
  }
}

async function deleteCustomer(req, res, next) {
  try {
    await crmService.deleteCustomer(req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

async function getQuotations(req, res, next) {
  try {
    return res.json({ quotations: await crmService.listQuotations() });
  } catch (err) {
    return next(err);
  }
}

async function postQuotation(req, res, next) {
  try {
    const quotation = await crmService.createQuotation(req.body);
    return res.status(201).json({ quotation });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
}

async function putQuotation(req, res, next) {
  try {
    const quotation = await crmService.updateQuotation(req.params.id, req.body);
    if (!quotation) return res.status(404).json({ error: 'Quotation not found.' });
    return res.json({ quotation });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
}

async function deleteQuotation(req, res, next) {
  try {
    await crmService.deleteQuotation(req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

async function convertQuotation(req, res, next) {
  try {
    const invoice = await crmService.convertQuotationToInvoice(req.body.id);
    if (!invoice) return res.status(404).json({ error: 'Quotation not found.' });
    return res.json({ invoice });
  } catch (err) {
    return next(err);
  }
}

async function getInvoices(req, res, next) {
  try {
    return res.json({ invoices: await crmService.listInvoices() });
  } catch (err) {
    return next(err);
  }
}

async function postInvoice(req, res, next) {
  try {
    const invoice = await crmService.createInvoice(req.body);
    return res.status(201).json({ invoice });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
}

async function putInvoice(req, res, next) {
  try {
    const invoice = await crmService.updateInvoice(req.params.id, req.body);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });
    return res.json({ invoice });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
}

async function deleteInvoice(req, res, next) {
  try {
    await crmService.deleteInvoice(req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

async function markPaid(req, res, next) {
  try {
    const result = await crmService.markInvoicePaid(req.body.id, req.body.mode);
    if (!result) return res.status(404).json({ error: 'Invoice not found.' });
    return res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    return next(err);
  }
}

async function getReceipts(req, res, next) {
  try {
    return res.json({ receipts: await crmService.listReceipts() });
  } catch (err) {
    return next(err);
  }
}

async function getSettings(req, res, next) {
  try {
    return res.json({ settings: await crmService.getSettings() });
  } catch (err) {
    return next(err);
  }
}

async function putSettings(req, res, next) {
  try {
    const settings = await crmService.saveSettings(req.body);
    return res.json({ settings });
  } catch (err) {
    return next(err);
  }
}

async function bulkImport(req, res, next) {
  try {
    const result = await crmService.bulkImportCrm(req.body);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getCustomers,
  postCustomer,
  putCustomer,
  deleteCustomer,
  getQuotations,
  postQuotation,
  putQuotation,
  deleteQuotation,
  convertQuotation,
  getInvoices,
  postInvoice,
  putInvoice,
  deleteInvoice,
  markPaid,
  getReceipts,
  getSettings,
  putSettings,
  bulkImport
};
