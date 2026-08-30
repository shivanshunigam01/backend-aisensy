require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { env } = require('./src/config/env');
const { connectMongo } = require('./src/config/db');
const { bootstrapData } = require('./src/config/bootstrap');
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

  server.listen(env.port, () => {
    console.log(`${AdWord.projectName} API running on port ${env.port}`);
    console.log(AdWord.tagline);
  });
}

start();
