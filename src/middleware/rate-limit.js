const { AppError } = require('../utils/errors');

function createRateLimit({ windowMs, max, message, keyPrefix }) {
  const store = new Map();
  let requestCount = 0;

  return function rateLimit(req, _res, next) {
    const now = Date.now();
    requestCount += 1;
    if (requestCount % 200 === 0) {
      for (const [key, value] of store.entries()) {
        if (!value || value.resetAt <= now) {
          store.delete(key);
        }
      }
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const current = store.get(key);

    if (!current || current.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      return next(new AppError(message, 429, 'RATE_LIMITED'));
    }

    return next();
  };
}

module.exports = {
  createRateLimit,
};
