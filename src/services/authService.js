const bcrypt = require('bcryptjs');
const User = require('../models/User');

function normalizeEmail(email) {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}

function userToPublic(doc) {
  return {
    fullName: doc.fullName,
    email: doc.email,
    phoneDialCode: doc.phoneDialCode,
    phoneNational: doc.phoneNational,
    companyName: doc.companyName,
    companyDescription: doc.companyDescription,
    country: doc.country,
    state: doc.state,
    companySize: doc.companySize,
    industry: doc.industry,
    websiteUrl: doc.websiteUrl,
    timezone: doc.timezone,
    picture: doc.picture || undefined,
    password: null,
    authMethod: doc.authMethod
  };
}

function isNonEmpty(s) {
  return typeof s === 'string' && s.trim().length > 0;
}

function validateRegisterPayload(body) {
  let authMethod = 'pending';
  if (body.authMethod === 'google') authMethod = 'google';
  else if (body.authMethod === 'password') authMethod = 'password';
  else if (body.authMethod === 'pending') authMethod = 'pending';

  const email = normalizeEmail(body.email);

  const profile = {
    fullName: typeof body.fullName === 'string' ? body.fullName.trim() : '',
    email,
    phoneDialCode: typeof body.phoneDialCode === 'string' ? body.phoneDialCode.trim() : '',
    phoneNational: typeof body.phoneNational === 'string' ? body.phoneNational.trim() : '',
    companyName: typeof body.companyName === 'string' ? body.companyName.trim() : '',
    companyDescription: typeof body.companyDescription === 'string' ? body.companyDescription.trim() : '',
    country: typeof body.country === 'string' ? body.country.trim() : '',
    state: typeof body.state === 'string' ? body.state.trim() : '',
    companySize: typeof body.companySize === 'string' ? body.companySize.trim() : '',
    industry: typeof body.industry === 'string' ? body.industry.trim() : '',
    websiteUrl: typeof body.websiteUrl === 'string' ? body.websiteUrl.trim() : '',
    timezone: typeof body.timezone === 'string' ? body.timezone.trim() : '',
    picture: typeof body.picture === 'string' ? body.picture.trim() : ''
  };

  const password = typeof body.password === 'string' ? body.password : '';

  if (!isNonEmpty(profile.fullName)) return { ok: false, error: 'Full name is required.' };
  if (!isNonEmpty(profile.email)) return { ok: false, error: 'Email is required.' };
  if (!isNonEmpty(profile.phoneNational)) return { ok: false, error: 'Phone number is required.' };
  if (!isNonEmpty(profile.phoneDialCode)) return { ok: false, error: 'Phone country code is required.' };
  if (!isNonEmpty(profile.companyName)) return { ok: false, error: 'Company name is required.' };
  if (!isNonEmpty(profile.companyDescription)) return { ok: false, error: 'Company description is required.' };
  if (!isNonEmpty(profile.country)) return { ok: false, error: 'Country is required.' };
  if (!isNonEmpty(profile.state)) return { ok: false, error: 'State / region is required.' };
  if (!isNonEmpty(profile.companySize)) return { ok: false, error: 'Company size is required.' };
  if (!isNonEmpty(profile.industry)) return { ok: false, error: 'Industry is required.' };
  if (!isNonEmpty(profile.websiteUrl)) return { ok: false, error: 'Website URL is required.' };
  if (!isNonEmpty(profile.timezone)) return { ok: false, error: 'Timezone is required.' };

  if (authMethod === 'password') {
    if (password.length < 6) return { ok: false, error: 'Password must be at least 6 characters.' };
  }

  return { ok: true, authMethod, profile, password };
}

async function register(body) {
  const v = validateRegisterPayload(body);
  if (!v.ok) return { ok: false, status: 400, error: v.error };

  const existing = await User.findOne({ email: v.profile.email });
  if (existing) {
    return { ok: false, status: 409, error: 'An account with this email already exists.' };
  }

  let passwordHash = null;
  if (v.authMethod === 'password') {
    passwordHash = await bcrypt.hash(v.password, 10);
  }
  /* pending + google: passwordHash stays null until an admin sets a password (future admin API). */

  const doc = await User.create({
    ...v.profile,
    passwordHash,
    authMethod: v.authMethod
  });

  return { ok: true, user: userToPublic(doc) };
}

async function login(emailRaw, password) {
  const email = normalizeEmail(emailRaw);
  if (!isNonEmpty(email) || !password) {
    return { ok: false, status: 400, error: 'Enter email and password.' };
  }

  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    return { ok: false, status: 401, error: 'Invalid email or password.' };
  }
  if (user.authMethod === 'pending') {
    return {
      ok: false,
      status: 403,
      error:
        'Your account is pending. An administrator will assign your password — please sign in after you receive access.'
    };
  }
  if (user.authMethod !== 'password' || !user.passwordHash) {
    return { ok: false, status: 401, error: 'Invalid email or password.' };
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return { ok: false, status: 401, error: 'Invalid email or password.' };
  }

  return { ok: true, user: userToPublic(user) };
}

async function existsByEmail(emailRaw) {
  const email = normalizeEmail(emailRaw);
  if (!email) {
    return { ok: false, status: 400, error: 'Email is required.' };
  }
  const user = await User.findOne({ email }).select('authMethod');
  if (!user) {
    return { ok: true, exists: false, authMethod: null };
  }
  return { ok: true, exists: true, authMethod: user.authMethod };
}

async function getProfileByEmail(emailRaw) {
  const email = normalizeEmail(emailRaw);
  if (!email) {
    return { ok: false, status: 400, error: 'Email is required.' };
  }
  const user = await User.findOne({ email });
  if (!user) {
    return { ok: false, status: 404, error: 'Not found.' };
  }
  return { ok: true, user: userToPublic(user) };
}

module.exports = {
  register,
  login,
  existsByEmail,
  getProfileByEmail,
  userToPublic,
  normalizeEmail
};
