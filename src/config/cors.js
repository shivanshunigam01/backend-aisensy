/** Permissive CORS — reflects any browser origin (required when credentials: true). */
const corsOptions = {
  origin(origin, callback) {
    callback(null, origin || true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Admin-Token'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

function applyCredentialedCorsHeaders(req, res, next) {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, X-Admin-Token'
    );
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Authorization');
    res.append('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
}

module.exports = { corsOptions, applyCredentialedCorsHeaders };
