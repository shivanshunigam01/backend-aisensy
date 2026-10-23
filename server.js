require('dotenv').config();
const http = require('http');
const { app, registerErrorHandlers } = require('./src/app');
const { env } = require('./src/config/env');
const { connectMongo } = require('./src/config/db');
const { bootstrapData } = require('./src/config/bootstrap');
const { mountPeopleflow } = require('./src/peopleflow/mount');
const AdWord = require('./src/utils/AdWord');

const server = http.createServer(app);

async function start() {
  try {
    await connectMongo();
    await bootstrapData();
  } catch (err) {
    console.error('[mongo] Connection failed:', err.message);
    console.error('[mongo] API will still listen; database routes return 503 until Mongo is reachable.');
  }

  try {
    await mountPeopleflow(app);
  } catch (err) {
    console.error('[PeopleFlow] Failed to mount /api/v1:', err.message);
    console.error('[PeopleFlow] Run `npm run hr:build` in backend-aisensy and ensure hr/.env JWT secrets are set.');
  }

  registerErrorHandlers();

  server.listen(env.port, () => {
    console.log(`${AdWord.projectName} API running on port ${env.port}`);
    console.log(AdWord.tagline);
  });
}

start();
