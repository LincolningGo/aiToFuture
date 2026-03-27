const config = require('../config');
const { AppError } = require('../utils/errors');

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function parseJsonSafe(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function maskApiKey(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (value.length <= 10) return `${value.slice(0, 3)}***${value.slice(-2)}`;
  return `${value.slice(0, 6)}***${value.slice(-4)}`;
}

function detectModelCategory(modelName) {
  const value = String(modelName || '').toLowerCase();
  if (/image|img|i2i|paint|photo/.test(value)) return 'image';
  if (/video|t2v|s2v|director|hailuo/.test(value)) return 'video';
  if (/music|lyrics|audio|speech|voice|t2a/.test(value)) return 'audio';
  return 'text';
}

function getCategorySortRank(category) {
  if (category === 'text') return 0;
  if (category === 'image') return 1;
  if (category === 'video') return 2;
  if (category === 'audio') return 3;
  return 9;
}

function formatUsageItem(row) {
  const intervalTotal = Math.max(Number(row.current_interval_total_count) || 0, 0);
  const intervalUsed = Math.max(Number(row.current_interval_usage_count) || 0, 0);
  const weeklyTotal = Math.max(Number(row.current_weekly_total_count) || 0, 0);
  const weeklyUsed = Math.max(Number(row.current_weekly_usage_count) || 0, 0);
  const intervalUsageRate = intervalTotal > 0 ? intervalUsed / intervalTotal : 0;
  const weeklyUsageRate = weeklyTotal > 0 ? weeklyUsed / weeklyTotal : 0;
  const modelName = row.model_name || '-';

  return {
    model_name: modelName,
    category: detectModelCategory(modelName),
    start_time: row.start_time || null,
    end_time: row.end_time || null,
    remains_time: Math.max(Number(row.remains_time) || 0, 0),
    current_interval_total_count: intervalTotal,
    current_interval_usage_count: intervalUsed,
    current_interval_remaining_count: Math.max(intervalTotal - intervalUsed, 0),
    current_interval_usage_rate: intervalUsageRate,
    current_weekly_total_count: weeklyTotal,
    current_weekly_usage_count: weeklyUsed,
    current_weekly_remaining_count: Math.max(weeklyTotal - weeklyUsed, 0),
    current_weekly_usage_rate: weeklyUsageRate,
    weekly_start_time: row.weekly_start_time || null,
    weekly_end_time: row.weekly_end_time || null,
    weekly_remains_time: Math.max(Number(row.weekly_remains_time) || 0, 0),
  };
}

function buildOverview(items) {
  return items.reduce(
    (acc, item) => {
      acc.modelCount += 1;
      acc.intervalTotal += item.current_interval_total_count;
      acc.intervalUsed += item.current_interval_usage_count;
      acc.weeklyTotal += item.current_weekly_total_count;
      acc.weeklyUsed += item.current_weekly_usage_count;
      if (item.current_interval_total_count > 0 && item.current_interval_usage_rate >= 1) acc.exhaustedModels += 1;
      if (item.current_interval_total_count > 0 && item.current_interval_usage_rate >= 0.8) acc.nearLimitModels += 1;
      return acc;
    },
    {
      modelCount: 0,
      intervalTotal: 0,
      intervalUsed: 0,
      weeklyTotal: 0,
      weeklyUsed: 0,
      exhaustedModels: 0,
      nearLimitModels: 0,
    },
  );
}

async function fetchMinimaxCodingPlanRemains() {
  const apiKey = String(config.minimaxApiKey || '').trim();
  if (!apiKey) {
    throw new AppError('MINIMAX_API_KEY is not configured', 400, 'MINIMAX_KEY_MISSING');
  }

  const base = trimTrailingSlash(config.minimaxOpenPlatformBase || 'https://www.minimaxi.com');
  const url = `${base}/v1/api/openplatform/coding_plan/remains`;

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    throw new AppError(`MiniMax remains request failed: ${err.message}`, 502, 'MINIMAX_USAGE_NETWORK_ERROR');
  }

  const text = await response.text();
  const payload = parseJsonSafe(text);
  if (!response.ok) {
    const message = payload?.base_resp?.status_msg || payload?.message || `MiniMax remains HTTP ${response.status}`;
    throw new AppError(message, 502, 'MINIMAX_USAGE_HTTP_ERROR');
  }

  if (!payload || Number(payload?.base_resp?.status_code ?? 0) !== 0) {
    const message = payload?.base_resp?.status_msg || 'MiniMax remains response invalid';
    throw new AppError(message, 502, 'MINIMAX_USAGE_INVALID_RESPONSE');
  }

  const items = Array.isArray(payload.model_remains) ? payload.model_remains.map(formatUsageItem) : [];
  items.sort((a, b) => {
    const rankDiff = getCategorySortRank(a.category) - getCategorySortRank(b.category);
    return rankDiff || a.model_name.localeCompare(b.model_name);
  });

  return {
    provider: 'minimax',
    source: 'coding_plan/remains',
    keyMasked: maskApiKey(apiKey),
    syncedAt: new Date().toISOString(),
    overview: buildOverview(items),
    items,
  };
}

module.exports = {
  fetchMinimaxCodingPlanRemains,
};
