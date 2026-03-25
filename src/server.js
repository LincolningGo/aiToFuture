require('dotenv').config();

const fs = require('fs/promises');
const app = require('./app');
const config = require('./config');
const { testConnection } = require('./db/mysql');

async function bootstrap() {
  await fs.mkdir(config.storageRoot, { recursive: true });

  try {
    await testConnection();
    console.log('[BOOT] MySQL connected');
  } catch (err) {
    console.error('[BOOT] MySQL connection failed, app still starts:', err.message);
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`[BOOT] aiToFuture running at http://127.0.0.1:${config.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('[BOOT] Fatal error:', err);
  process.exit(1);
});
