const jwt = require('jsonwebtoken');
const config = require('../config');
const { pool } = require('../db/mysql');
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

async function requireAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) {
    return next(new AppError('Please login first', 401, 'UNAUTHORIZED'));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const [rows] = await pool.query(
      'SELECT id, username, email, role, is_active FROM users WHERE id = ? LIMIT 1',
      [payload.userId],
    );
    if (rows.length === 0) {
      return next(new AppError('User not found', 401, 'INVALID_TOKEN'));
    }

    const user = rows[0];
    if (!user.is_active) {
      return next(new AppError('User is disabled', 403, 'USER_DISABLED'));
    }

    req.auth = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role || 'user',
    };
    return next();
  } catch (err) {
    if (err instanceof AppError) {
      return next(err);
    }
    return next(new AppError('Invalid or expired token', 401, 'INVALID_TOKEN'));
  }
}

function requireRole(roles) {
  const allowedRoles = new Set(Array.isArray(roles) ? roles : [roles]);
  return function checkRole(req, _res, next) {
    if (!req.auth) {
      return next(new AppError('Please login first', 401, 'UNAUTHORIZED'));
    }
    if (!allowedRoles.has(req.auth.role)) {
      return next(new AppError('Access denied', 403, 'FORBIDDEN'));
    }
    return next();
  };
}

const requireSuperAdmin = requireRole('super_admin');

module.exports = {
  requireAuth,
  requireRole,
  requireSuperAdmin,
};
