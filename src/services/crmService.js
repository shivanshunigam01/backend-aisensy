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

async function nextNumber(Model, prefix) {
  const count = await Model.countDocuments();
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}

function docTotal(items, gstPercent) {
  const sub = (items || []).reduce((s, it) => s + (it.qty || 0) * (it.rate || 0), 0);
  return sub * (1 + (gstPercent || 0) / 100);
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
  const number = body.number || (await nextNumber(Quotation, 'QT'));
  const doc = await Quotation.create({ ...body, number });
  return Quotation.toPublic(doc);
}

async function updateQuotation(id, body) {
  const doc = await Quotation.findByIdAndUpdate(id, body, { new: true });
  if (!doc) return null;
  return Quotation.toPublic(doc);
}

async function deleteQuotation(id) {
  return Quotation.findByIdAndDelete(id);
}

async function convertQuotationToInvoice(id) {
  const qt = await Quotation.findById(id);
  if (!qt) return null;
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
  const number = body.number || (await nextNumber(Invoice, 'INV'));
  const doc = await Invoice.create({ ...body, number });
  return Invoice.toPublic(doc);
}

async function updateInvoice(id, body) {
  const doc = await Invoice.findByIdAndUpdate(id, body, { new: true });
  if (!doc) return null;
  return Invoice.toPublic(doc);
}

async function deleteInvoice(id) {
  return Invoice.findByIdAndDelete(id);
}

async function markInvoicePaid(id, mode = 'Bank Transfer') {
  const inv = await Invoice.findById(id);
  if (!inv) return null;
  inv.status = 'paid';
  inv.paidAt = new Date().toISOString().slice(0, 10);
  await inv.save();

  const amount = Math.round(docTotal(inv.items, inv.gstPercent));
  const rcNumber = await nextNumber(Receipt, 'RC');
  const receipt = await Receipt.create({
    number: rcNumber,
    invoiceId: inv._id,
    customerId: inv.customerId,
    amount,
    date: inv.paidAt,
    mode
  });

  await Customer.findByIdAndUpdate(inv.customerId, { $inc: { totalSpend: amount } });

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

async function bulkImportCrm(payload) {
  const { customers = [], quotations = [], invoices = [], receipts = [], settings } = payload;
  if (customers.length) {
    for (const c of customers) {
      await Customer.findOneAndUpdate(
        { email: c.email, phone: c.phone },
        { ...c, totalSpend: c.totalSpend || 0 },
        { upsert: true, new: true }
      );
    }
  }
  if (settings) await saveSettings(settings);
  return { ok: true, imported: { customers: customers.length, quotations: quotations.length, invoices: invoices.length } };
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
