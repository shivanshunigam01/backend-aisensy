const adminAuthService = require('../services/adminAuthService');

async function postLogin(req, res, next) {
  try {
    const result = await adminAuthService.login(req.body.email, req.body.password);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.json({ ok: true, token: result.token, admin: result.admin });
  } catch (err) {
    return next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const result = await adminAuthService.getMe(req.adminUserId);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    return res.json({ ok: true, admin: result.admin });
  } catch (err) {
    return next(err);
  }
}

module.exports = { postLogin, getMe };
