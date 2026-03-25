const path = require('path');

function toInt(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 4002),
  appBaseUrl: process.env.APP_BASE_URL || 'http://127.0.0.1:4002',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: toInt(process.env.DB_PORT, 7777),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'aitofuture',
    connectionLimit: toInt(process.env.DB_CONNECTION_LIMIT, 10),
  },
  storageRoot: process.env.STORAGE_ROOT || path.join(process.cwd(), 'storage', 'generated'),
  aiProvider: process.env.AI_PROVIDER || 'minimax_mock',
  minimaxApiBase: process.env.MINIMAX_API_BASE || 'https://api.minimaxi.com',
  minimaxApiKey: process.env.MINIMAX_API_KEY || '',
  minimaxImageModel: process.env.MINIMAX_IMAGE_MODEL || 'image-01',
  minimaxVideoModel: process.env.MINIMAX_VIDEO_MODEL || 'T2V-01-Director',
  minimaxT2aModel: process.env.MINIMAX_T2A_MODEL || 'speech-02-hd',
  minimaxT2aVoiceId: process.env.MINIMAX_T2A_VOICE_ID || 'male-qn-qingse',
  minimaxVideoPollIntervalMs: toInt(process.env.MINIMAX_VIDEO_POLL_INTERVAL_MS, 5000),
  minimaxVideoPollMaxAttempts: toInt(process.env.MINIMAX_VIDEO_POLL_MAX_ATTEMPTS, 120),
  defaultRegisterPoints: toInt(process.env.DEFAULT_REGISTER_POINTS, 100),
  costs: {
    text_to_image: toInt(process.env.COST_TEXT_TO_IMAGE, 10),
    image_to_image: toInt(process.env.COST_IMAGE_TO_IMAGE, 12),
    text_to_video: toInt(process.env.COST_TEXT_TO_VIDEO, 30),
    text_to_audio: toInt(process.env.COST_TEXT_TO_AUDIO, 8),
    lyrics_generation: toInt(process.env.COST_LYRICS_GENERATION, 6),
    music_generation: toInt(process.env.COST_MUSIC_GENERATION, 20),
  },
};

module.exports = config;
