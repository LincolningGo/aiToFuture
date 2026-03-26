const config = require('../config');
const { pool } = require('../db/mysql');

const SETTING_KEYS = {
  registerEnabled: 'register_enabled',
  registerBonusPoints: 'register_bonus_points',
};

const DEFAULT_SYSTEM_SETTINGS = {
  registerEnabled: true,
  registerBonusPoints: Math.max(Number(config.defaultRegisterPoints) || 0, 0),
};

function toBooleanValue(value, fallback = false) {
  if (value === true || value === '1' || value === 1 || value === 'true') return true;
  if (value === false || value === '0' || value === 0 || value === 'false') return false;
  return fallback;
}

function toIntValue(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

async function ensureSystemSettings(conn = pool) {
  await conn.query(
    `CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(64) NOT NULL,
      setting_value VARCHAR(255) NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );

  await conn.query(
    `INSERT INTO system_settings (setting_key, setting_value)
     VALUES (?, ?), (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = setting_value`,
    [
      SETTING_KEYS.registerEnabled,
      DEFAULT_SYSTEM_SETTINGS.registerEnabled ? '1' : '0',
      SETTING_KEYS.registerBonusPoints,
      String(DEFAULT_SYSTEM_SETTINGS.registerBonusPoints),
    ],
  );
}

async function getSystemSettings(conn = pool) {
  await ensureSystemSettings(conn);
  const [rows] = await conn.query(
    'SELECT setting_key, setting_value, updated_at FROM system_settings WHERE setting_key IN (?, ?)',
    [SETTING_KEYS.registerEnabled, SETTING_KEYS.registerBonusPoints],
  );

  const map = rows.reduce((acc, row) => {
    acc[row.setting_key] = row.setting_value;
    return acc;
  }, {});

  return {
    registerEnabled: toBooleanValue(map[SETTING_KEYS.registerEnabled], DEFAULT_SYSTEM_SETTINGS.registerEnabled),
    registerBonusPoints: Math.max(
      toIntValue(map[SETTING_KEYS.registerBonusPoints], DEFAULT_SYSTEM_SETTINGS.registerBonusPoints),
      0,
    ),
  };
}

async function updateSystemSettings(values, conn = pool) {
  await ensureSystemSettings(conn);
  const registerEnabled = toBooleanValue(values.registerEnabled, DEFAULT_SYSTEM_SETTINGS.registerEnabled);
  const registerBonusPoints = Math.max(
    toIntValue(values.registerBonusPoints, DEFAULT_SYSTEM_SETTINGS.registerBonusPoints),
    0,
  );

  await conn.query(
    `INSERT INTO system_settings (setting_key, setting_value)
     VALUES (?, ?), (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
    [
      SETTING_KEYS.registerEnabled,
      registerEnabled ? '1' : '0',
      SETTING_KEYS.registerBonusPoints,
      String(registerBonusPoints),
    ],
  );

  return {
    registerEnabled,
    registerBonusPoints,
  };
}

module.exports = {
  DEFAULT_SYSTEM_SETTINGS,
  SETTING_KEYS,
  ensureSystemSettings,
  getSystemSettings,
  updateSystemSettings,
};
