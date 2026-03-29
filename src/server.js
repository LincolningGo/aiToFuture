require('dotenv').config();

const fs = require('fs/promises');
const app = require('./app');
const config = require('./config');
const { testConnection } = require('./db/mysql');
const { recoverInFlightJobsOnStartup } = require('./services/generation-service');

async function bootstrap() {
  if (!config.jwtSecret || config.jwtSecret === 'dev_secret_change_me' || String(config.jwtSecret).length < 32) {
    throw new Error('JWT_SECRET is missing or too weak; please set a strong secret (32+ chars)');
  }

  await fs.mkdir(config.storageRoot, { recursive: true });

  try {
    await testConnection();
    console.log('[BOOT] MySQL connected');

    try {
      const result = await recoverInFlightJobsOnStartup();
      if (result.scanned > 0) {
        console.log('[BOOT] Queue recovery finished:', result);
      }
    } catch (err) {
      console.error('[BOOT] Queue recovery failed:', err.message);
    }
  } catch (err) {
    console.error('[BOOT] MySQL connection failed, app still starts:', err.message);
  }

  app.listen(config.port, '0.0.0.0', () => {
    console.log(`[BOOT] ATF running at http://127.0.0.1:${config.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('[BOOT] Fatal error:', err);
  process.exit(1);
});
