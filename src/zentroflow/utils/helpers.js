/** Normalize Indian / international mobiles to digits-only canonical form. */
function normalizeMobile(raw, defaultCountry = '91') {
  if (!raw) return '';
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) digits = defaultCountry + digits;
  if (digits.length === 11 && digits.startsWith('0')) digits = defaultCountry + digits.slice(1);
  return digits;
}

function temperatureFromScore(score) {
  if (score >= 40) return 'hot';
  if (score >= 15) return 'warm';
  return 'cold';
}

function slugifyKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function pagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 25));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function errorEnvelope(code, message, correlationId, details) {
  const body = { code, message, correlation_id: correlationId || null };
  if (details) body.details = details;
  return body;
}

module.exports = {
  normalizeMobile,
  temperatureFromScore,
  slugifyKey,
  pagination,
  errorEnvelope
};
