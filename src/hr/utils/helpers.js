function ok(res, data = null, message = 'OK', status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function fail(res, message, status = 400, code = 'BAD_REQUEST') {
  return res.status(status).json({ success: false, message, error: code, data: null });
}

function slugify(name) {
  const base = String(name || 'org')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'org'}-${Date.now().toString(36).slice(-4)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(start, end) {
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0;
  return Math.floor((b - a) / 86400000) + 1;
}

function isHrAdminRole(role) {
  return role === 'SUPER_ADMIN' || role === 'HR_ADMIN';
}

module.exports = { ok, fail, slugify, todayISO, daysBetween, isHrAdminRole };
