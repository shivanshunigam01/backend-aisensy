const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Quotation = require('../models/Quotation');
const Invoice = require('../models/Invoice');
const Receipt = require('../models/Receipt');
const CompanySettings = require('../models/CompanySettings');

const DEFAULT_SETTINGS = {
  name: 'Zentroverse Pvt Ltd',
  address: '5th Floor, Spectrum Tower, MG Road, Bengaluru, Karnataka 560001',
  gstin: '29AAACZ1234F1Z5',
  phone: '+91 80 1234 5678',
  email: 'billing@zentroverse.in',
  defaultGstPercent: 18,
  bankDetails: 'HDFC Bank • A/c 50100123456789 • IFSC HDFC0000123',
  footerNote: 'Thank you for your business with Zentroverse.',
  logoDataUrl: ''
};

const PAY_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card'];

async function nextNumber(Model, prefix) {
  const docs = await Model.find({ number: new RegExp(`^${prefix}-`) })
    .select('number')
    .lean();
  let max = 0;
  for (const d of docs) {
    const n = parseInt(String(d.number).replace(`${prefix}-`, ''), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

function docTotal(items, gstPercent) {
  const sub = (items || []).reduce((s, it) => s + (it.qty || 0) * (it.rate || 0), 0);
  return sub * (1 + (gstPercent || 0) / 100);
}

function assertCustomerId(customerId) {
  if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
    const err = new Error('A valid customer is required.');
    err.status = 400;
    throw err;
  }
}

function normalizeItems(items) {
  return (items || [])
    .filter((it) => it && String(it.description || '').trim())
    .map((it) => ({
      id: it.id || new mongoose.Types.ObjectId().toString(),
      description: String(it.description).trim(),
      qty: Number(it.qty) || 0,
      rate: Number(it.rate) || 0
    }));
}

function assertItems(items) {
  if (!items.length) {
    const err = new Error('Add at least one line item with a description.');
    err.status = 400;
    throw err;
  }
}

// Customers
async function listCustomers() {
  const docs = await Customer.find().sort({ createdAt: -1 }).limit(2000);
  return docs.map(Customer.toPublic);
}

async function createCustomer(body) {
  const doc = await Customer.create(body);
  return Customer.toPublic(doc);
}

async function updateCustomer(id, body) {
  const doc = await Customer.findByIdAndUpdate(id, body, { new: true });
  if (!doc) return null;
  return Customer.toPublic(doc);
}

async function deleteCustomer(id) {
  return Customer.findByIdAndDelete(id);
}

// Quotations
async function listQuotations() {
  const docs = await Quotation.find().sort({ createdAt: -1 }).limit(2000);
  return docs.map(Quotation.toPublic);
}

async function createQuotation(body) {
  assertCustomerId(body.customerId);
  const items = normalizeItems(body.items);
  assertItems(items);
  const number = body.number && String(body.number).trim() ? String(body.number).trim() : await nextNumber(Quotation, 'QT');
  const doc = await Quotation.create({
    ...body,
    number,
    items,
    customerId: body.customerId
  });
  return Quotation.toPublic(doc);
}

async function updateQuotation(id, body) {
  if (body.customerId) assertCustomerId(body.customerId);
  const patch = { ...body };
  if (body.items) {
    patch.items = normalizeItems(body.items);
    assertItems(patch.items);
  }
  const doc = await Quotation.findByIdAndUpdate(id, patch, { new: true });
  if (!doc) return null;
  return Quotation.toPublic(doc);
}

async function deleteQuotation(id) {
  return Quotation.findByIdAndDelete(id);
}

async function convertQuotationToInvoice(id) {
  const qt = await Quotation.findById(id);
  if (!qt) return null;

  const existing = await Invoice.findOne({ quotationId: qt._id });
  if (existing) {
    if (qt.status !== 'accepted') {
      qt.status = 'accepted';
      await qt.save();
    }
    return Invoice.toPublic(existing);
  }

  const number = await nextNumber(Invoice, 'INV');
  const inv = await Invoice.create({
    number,
    customerId: qt.customerId,
    quotationId: qt._id,
    date: new Date().toISOString().slice(0, 10),
    dueDate: qt.dueDate,
    items: qt.items,
    gstPercent: qt.gstPercent,
    notes: qt.notes,
    status: 'sent'
  });
  qt.status = 'accepted';
  await qt.save();
  return Invoice.toPublic(inv);
}

// Invoices
async function listInvoices() {
  const docs = await Invoice.find().sort({ createdAt: -1 }).limit(2000);
  return docs.map(Invoice.toPublic);
}

async function createInvoice(body) {
  assertCustomerId(body.customerId);
  const items = normalizeItems(body.items);
  assertItems(items);
  const number = body.number && String(body.number).trim() ? String(body.number).trim() : await nextNumber(Invoice, 'INV');
  const doc = await Invoice.create({
    ...body,
    number,
    items,
    customerId: body.customerId
  });
  return Invoice.toPublic(doc);
}

async function updateInvoice(id, body) {
  if (body.customerId) assertCustomerId(body.customerId);
  const patch = { ...body };
  if (body.items) {
    patch.items = normalizeItems(body.items);
    assertItems(patch.items);
  }
  const doc = await Invoice.findByIdAndUpdate(id, patch, { new: true });
  if (!doc) return null;
  return Invoice.toPublic(doc);
}

async function deleteInvoice(id) {
  return Invoice.findByIdAndDelete(id);
}

async function markInvoicePaid(id, mode = 'Bank Transfer') {
  const inv = await Invoice.findById(id);
  if (!inv) return null;

  const safeMode = PAY_MODES.includes(mode) ? mode : 'Bank Transfer';
  const existing = await Receipt.findOne({ invoiceId: inv._id });

  if (inv.status === 'paid' && existing) {
    return { invoice: Invoice.toPublic(inv), receipt: Receipt.toPublic(existing) };
  }

  const amount = Math.round(docTotal(inv.items, inv.gstPercent));
  const paidAt = new Date().toISOString().slice(0, 10);

  if (inv.status !== 'paid') {
    inv.status = 'paid';
    inv.paidAt = paidAt;
    await inv.save();
  }

  let receipt = existing;
  if (!receipt) {
    const rcNumber = await nextNumber(Receipt, 'RC');
    receipt = await Receipt.create({
      number: rcNumber,
      invoiceId: inv._id,
      customerId: inv.customerId,
      amount,
      date: inv.paidAt || paidAt,
      mode: safeMode
    });
    await Customer.findByIdAndUpdate(inv.customerId, { $inc: { totalSpend: amount } });
  }

  return { invoice: Invoice.toPublic(inv), receipt: Receipt.toPublic(receipt) };
}

// Receipts
async function listReceipts() {
  const docs = await Receipt.find().sort({ createdAt: -1 }).limit(2000);
  return docs.map(Receipt.toPublic);
}

// Settings
async function getSettings() {
  let doc = await CompanySettings.findOne({ key: 'main' });
  if (!doc) {
    doc = await CompanySettings.create({ key: 'main', ...DEFAULT_SETTINGS });
  }
  return CompanySettings.toPublic(doc);
}

async function saveSettings(body) {
  const doc = await CompanySettings.findOneAndUpdate({ key: 'main' }, body, { new: true, upsert: true });
  return CompanySettings.toPublic(doc);
}

async function resolveCustomerId(rawId, customerMap) {
  if (!rawId) return null;
  if (customerMap.has(rawId)) return customerMap.get(rawId);
  if (mongoose.Types.ObjectId.isValid(rawId)) return rawId;
  return null;
}

async function bulkImportCrm(payload) {
  const { customers = [], quotations = [], invoices = [], receipts = [], settings } = payload;
  const customerMap = new Map();

  for (const c of customers) {
    const filter =
      c.email || c.phone
        ? { $or: [c.email ? { email: c.email } : null, c.phone ? { phone: c.phone } : null].filter(Boolean) }
        : { name: c.name, company: c.company || '' };

    const { id: legacyId, createdAt, ...rest } = c;
    const doc = await Customer.findOneAndUpdate(
      filter,
      { ...rest, totalSpend: c.totalSpend || 0 },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (legacyId) customerMap.set(legacyId, doc._id.toString());
    customerMap.set(doc._id.toString(), doc._id.toString());
  }

  const quotationMap = new Map();
  let quotationsImported = 0;
  for (const q of quotations) {
    const customerId = await resolveCustomerId(q.customerId, customerMap);
    if (!customerId) continue;
    const number = q.number || (await nextNumber(Quotation, 'QT'));
    const items = normalizeItems(q.items);
    if (!items.length) continue;
    const doc = await Quotation.findOneAndUpdate(
      { number },
      {
        number,
        customerId,
        date: q.date || new Date().toISOString().slice(0, 10),
        dueDate: q.dueDate || '',
        items,
        gstPercent: q.gstPercent ?? 18,
        notes: q.notes || '',
        status: q.status || 'draft'
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (q.id) quotationMap.set(q.id, doc._id.toString());
    quotationMap.set(doc._id.toString(), doc._id.toString());
    quotationsImported += 1;
  }

  const invoiceMap = new Map();
  let invoicesImported = 0;
  for (const inv of invoices) {
    const customerId = await resolveCustomerId(inv.customerId, customerMap);
    if (!customerId) continue;
    const number = inv.number || (await nextNumber(Invoice, 'INV'));
    const items = normalizeItems(inv.items);
    if (!items.length) continue;
    const quotationId =
      inv.quotationId && quotationMap.has(inv.quotationId)
        ? quotationMap.get(inv.quotationId)
        : inv.quotationId && mongoose.Types.ObjectId.isValid(inv.quotationId)
          ? inv.quotationId
          : null;
    const doc = await Invoice.findOneAndUpdate(
      { number },
      {
        number,
        customerId,
        quotationId,
        date: inv.date || new Date().toISOString().slice(0, 10),
        dueDate: inv.dueDate || '',
        items,
        gstPercent: inv.gstPercent ?? 18,
        notes: inv.notes || '',
        status: inv.status || 'draft',
        paidAt: inv.paidAt || ''
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (inv.id) invoiceMap.set(inv.id, doc._id.toString());
    invoiceMap.set(doc._id.toString(), doc._id.toString());
    invoicesImported += 1;
  }

  let receiptsImported = 0;
  for (const r of receipts) {
    const customerId = await resolveCustomerId(r.customerId, customerMap);
    const invoiceId =
      r.invoiceId && invoiceMap.has(r.invoiceId)
        ? invoiceMap.get(r.invoiceId)
        : r.invoiceId && mongoose.Types.ObjectId.isValid(r.invoiceId)
          ? r.invoiceId
          : null;
    if (!customerId || !invoiceId) continue;
    const number = r.number || (await nextNumber(Receipt, 'RC'));
    await Receipt.findOneAndUpdate(
      { number },
      {
        number,
        invoiceId,
        customerId,
        amount: r.amount || 0,
        date: r.date || new Date().toISOString().slice(0, 10),
        mode: PAY_MODES.includes(r.mode) ? r.mode : 'Bank Transfer'
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    receiptsImported += 1;
  }

  if (settings) await saveSettings(settings);

  return {
    ok: true,
    imported: {
      customers: customers.length,
      quotations: quotationsImported,
      invoices: invoicesImported,
      receipts: receiptsImported
    }
  };
}

module.exports = {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  listQuotations,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  convertQuotationToInvoice,
  listInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  markInvoicePaid,
  listReceipts,
  getSettings,
  saveSettings,
  bulkImportCrm
};
