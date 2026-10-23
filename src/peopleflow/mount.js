const path = require('path');
const { pathToFileURL } = require('url');

const { env: siteEnv } = require('../config/env');

/** @type {import('express').ErrorRequestHandler | null} */
let peopleflowErrorHandler = null;

function applyPeopleflowEnv() {
  const devAccess =
    'dev-peopleflow-access-secret-min16chars';
  const devRefresh =
    'dev-peopleflow-refresh-secret-min16chars';

  if (!process.env.JWT_ACCESS_SECRET) {
    process.env.JWT_ACCESS_SECRET =
      process.env.HR_JWT_ACCESS_SECRET ||
      process.env.HR_JWT_SECRET ||
      devAccess;
  }
  if (!process.env.JWT_REFRESH_SECRET) {
    process.env.JWT_REFRESH_SECRET =
      process.env.HR_JWT_REFRESH_SECRET || devRefresh;
  }

  if (process.env.PEOPLEFLOW_MONGODB_URI) {
    process.env.MONGODB_URI = process.env.PEOPLEFLOW_MONGODB_URI;
  } else if (siteEnv.mongodbUri) {
    process.env.MONGODB_URI = siteEnv.mongodbUri;
  }

  if (!process.env.APP_URL) {
    process.env.APP_URL =
      process.env.PEOPLEFLOW_APP_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://www.zentroverse.com'
        : 'http://localhost:8080');
  }

  const corsSet = new Set(siteEnv.corsOrigins);
  const appUrl = process.env.APP_URL || process.env.PEOPLEFLOW_APP_URL;
  if (appUrl) {
    try {
      corsSet.add(new URL(appUrl).origin);
    } catch {
      /* ignore invalid APP_URL */
    }
  }
  corsSet.add('http://localhost:8080');
  corsSet.add('http://127.0.0.1:8080');
  corsSet.add('https://www.zentroverse.com');
  corsSet.add('https://zentroverse.com');
  process.env.CORS_ORIGIN = [...corsSet].join(',');

  if (process.env.ALLOW_PUBLIC_REGISTER === undefined) {
    process.env.ALLOW_PUBLIC_REGISTER = siteEnv.hrAllowPublicRegister
      ? 'true'
      : 'false';
  }

  if (!process.env.REFRESH_COOKIE_PATH) {
    process.env.REFRESH_COOKIE_PATH = '/api';
  }

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.TRUST_PROXY) process.env.TRUST_PROXY = 'true';
    if (!process.env.COOKIE_SAMESITE) process.env.COOKIE_SAMESITE = 'none';
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME && siteEnv.cloudinaryCloudName) {
    process.env.CLOUDINARY_CLOUD_NAME = siteEnv.cloudinaryCloudName;
    process.env.CLOUDINARY_API_KEY = siteEnv.cloudinaryApiKey;
    process.env.CLOUDINARY_API_SECRET = siteEnv.cloudinaryApiSecret;
    process.env.CLOUDINARY_FOLDER =
      process.env.CLOUDINARY_FOLDER || siteEnv.cloudinaryUploadFolder;
  }
}

function hrDistFile(relativePath) {
  return pathToFileURL(
    path.join(__dirname, '../../hr/dist', relativePath)
  ).href;
}

/**
 * Mount PeopleFlow REST API at /api/v1 on the main Express app.
 * @param {import('express').Express} app
 */
async function mountPeopleflow(app) {
  applyPeopleflowEnv();

  const dbMod = await import(hrDistFile('config/db.js'));
  try {
    await dbMod.connectDatabase();
  } catch (err) {
    console.warn(
      '[PeopleFlow] MongoDB connect failed:',
      err instanceof Error ? err.message : err
    );
    console.warn(
      '[PeopleFlow] Mounting /api/v1 anyway; HR routes need MongoDB (set MONGODB_URI or PEOPLEFLOW_MONGODB_URI).'
    );
  }

  const routesMod = await import(hrDistFile('routes/index.js'));
  const errorMod = await import(hrDistFile('middleware/error-handler.js'));

  peopleflowErrorHandler = errorMod.errorHandler;
  const peopleflowRouter = routesMod.createApiRouter();
  app.use('/api/v1', peopleflowRouter);
  app.use('/api/hr', peopleflowRouter);

  console.info('[PeopleFlow] /api/v1 and legacy /api/hr mounted');
}

function getPeopleflowErrorHandler() {
  return peopleflowErrorHandler;
}

module.exports = {
  mountPeopleflow,
  getPeopleflowErrorHandler,
};
