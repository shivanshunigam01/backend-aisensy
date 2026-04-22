const mongoose = require('mongoose');
const { env } = require('./env');

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

  await mongoose.connect(env.mongodbUri, {
    maxPoolSize: 10
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
