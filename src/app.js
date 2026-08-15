const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const { getMongoHealth } = require('./config/db');
const { env } = require('./config/env');
const { isCloudinaryConfigured } = require('./services/cloudinaryService');
const { notFoundHandler } = require('./middleware/notFoundHandler');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(null, true);
    },
    credentials: true
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  const mongo = getMongoHealth();
  return res.status(200).json({
    ok: true,
    service: 'trader-backend-mvc',
    mongo,
    cloudinary: isCloudinaryConfigured()
  });
});

app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
