const { env } = require('./env');

function parseOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isLocalDevOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

/**
 * @param {string | undefined} origin
 * @returns {boolean}
 */
function isAllowedCorsOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (env.corsOrigins.includes(origin)) {
    return true;
  }

  const peopleflowOrigin = parseOrigin(process.env.PEOPLEFLOW_APP_URL || '');
  if (peopleflowOrigin && origin === peopleflowOrigin) {
    return true;
  }

  if (env.nodeEnv !== 'production' && isLocalDevOrigin(origin)) {
    return true;
  }

  return false;
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin || isAllowedCorsOrigin(origin)) {
      return callback(null, origin || true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 204,
};

module.exports = { corsOptions, isAllowedCorsOrigin };
