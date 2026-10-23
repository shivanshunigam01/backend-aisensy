const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
const { getMongoHealth } = require('./config/db');
const { env } = require('./config/env');
const { corsOptions } = require('./config/cors');
const { isCloudinaryConfigured } = require('./services/cloudinaryService');
const { notFoundHandler } = require('./middleware/notFoundHandler');
const { errorHandler } = require('./middleware/errorHandler');
const { getPeopleflowErrorHandler } = require('./peopleflow/mount');

const app = express();

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
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

function registerErrorHandlers() {
  const pfError = getPeopleflowErrorHandler();
  if (pfError) {
    app.use((err, req, res, next) => {
      if (req.originalUrl.startsWith('/api/v1')) {
        return pfError(err, req, res, next);
      }
      return next(err);
    });
  }
  app.use(notFoundHandler);
  app.use(errorHandler);
}

module.exports = { app, registerErrorHandlers };
