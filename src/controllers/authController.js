const authService = require('../services/authService');

async function getExists(req, res, next) {
  try {
    const email = req.query.email;
    const result = await authService.existsByEmail(email);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(200).json({
      exists: result.exists,
      authMethod: result.authMethod
    });
  } catch (err) {
    return next(err);
  }
}

async function postRegister(req, res, next) {
  try {
    const result = await authService.register(req.body ?? {});
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(201).json({ user: result.user });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    return next(err);
  }
}

async function postLogin(req, res, next) {
  try {
    const { email, password } = req.body ?? {};
    const result = await authService.login(email, password);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(200).json({ user: result.user });
  } catch (err) {
    return next(err);
  }
}

async function getProfile(req, res, next) {
  try {
    const email = req.query.email;
    const result = await authService.getProfileByEmail(email);
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.status(200).json({ user: result.user });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getExists, getProfile, postRegister, postLogin };
