const jwt = require('jsonwebtoken');
const config = require('../config');
const { AppError } = require('../utils/errors');

function readToken(req) {
  const cookieToken = req.cookies ? req.cookies.aft_token : null;
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function requireAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) {
    return next(new AppError('Please login first', 401, 'UNAUTHORIZED'));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.auth = {
      userId: payload.userId,
      username: payload.username,
      email: payload.email,
      role: payload.role || 'user',
    };
    return next();
  } catch (err) {
    return next(new AppError('Invalid or expired token', 401, 'INVALID_TOKEN'));
  }
}

module.exports = {
  requireAuth,
};
