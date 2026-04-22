const mongoose = require('mongoose');

function requireMongo(_req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: 'Database is not available. Set MONGODB_URI and ensure MongoDB is reachable.'
    });
  }
  next();
}

module.exports = { requireMongo };
