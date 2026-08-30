const dns = require('dns');
const mongoose = require('mongoose');
const { env } = require('./env');

const PUBLIC_DNS = ['8.8.8.8', '1.1.1.1'];

function atlasHostname(uri) {
  try {
    return new URL(uri.replace(/^mongodb\+srv:\/\//i, 'https://')).hostname;
  } catch {
    return null;
  }
}

/**
 * Windows/ISP DNS often refuses mongodb+srv SRV lookups (querySrv ECONNREFUSED).
 * Fall back to public DNS only when the system resolver fails.
 */
async function ensureSrvDns(uri) {
  if (!uri || !/^mongodb\+srv:/i.test(uri)) return;
  const host = atlasHostname(uri);
  if (!host) return;

  try {
    await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
  } catch (err) {
    console.warn(`[mongo] System DNS SRV lookup failed (${err.code || err.message}); using 8.8.8.8`);
    dns.setServers(PUBLIC_DNS);
  }
}

/**
 * Connect to MongoDB (Atlas). Safe to skip if MONGODB_URI is unset (dev without DB).
 * @returns {Promise<void>}
 */
async function connectMongo() {
  if (!env.mongodbUri) {
    console.warn('[mongo] MONGODB_URI is not set — API runs without a database connection.');
    return;
  }

  mongoose.set('strictQuery', true);
  await ensureSrvDns(env.mongodbUri);

  await mongoose.connect(env.mongodbUri, {
    maxPoolSize: 10,
    family: 4,
    serverSelectionTimeoutMS: 15000
  });

  console.log('[mongo] Connected to MongoDB');
}

/** For /health — readyState: 0 disconnected, 1 connected, 2 connecting, 3 disconnecting */
function getMongoHealth() {
  if (!env.mongodbUri) {
    return { configured: false, readyState: null };
  }
  return { configured: true, readyState: mongoose.connection.readyState };
}

module.exports = { connectMongo, mongoose, getMongoHealth };
