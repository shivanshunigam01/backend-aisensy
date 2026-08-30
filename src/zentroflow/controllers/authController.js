const authService = require('../services/authService');
const { errorEnvelope } = require('../utils/helpers');
const { User } = require('../models');

async function postLogin(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json(errorEnvelope('VALIDATION', 'email and password required', req.correlationId));
    }
    const result = await authService.login(email, password);
    if (!result.ok) {
      return res.status(401).json(errorEnvelope('AUTH_FAILED', result.message, req.correlationId));
    }
    return res.json({ token: result.token, user: result.user });
  } catch (err) {
    return next(err);
  }
}

async function getMe(req, res) {
  if (!req.zfUser?.id) {
    return res.json({ user: req.zfUser });
  }
  const user = await User.findById(req.zfUser.id);
  return res.json({ user: user ? User.toPublic(user) : req.zfUser });
}

module.exports = { postLogin, getMe };
