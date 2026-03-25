const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { pool } = require('../db/mysql');
const { AppError } = require('../utils/errors');
const { createRateLimit } = require('../middleware/rate-limit');
const { validateRegisterInput } = require('../utils/validators');

const router = express.Router();
const loginRateLimit = createRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Too many login attempts, please try again later',
  keyPrefix: 'auth:login',
});
const registerRateLimit = createRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  message: 'Too many register attempts, please try again later',
  keyPrefix: 'auth:register',
});

function signToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role || 'user',
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}

function isSecureRequest(req) {
  if (req.secure) return true;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return forwardedProto === 'https';
}

function setAuthCookie(req, res, token) {
  const secure = isSecureRequest(req);
  res.cookie('aft_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

router.post('/register', registerRateLimit, async (req, res, next) => {
  try {
    const { username, email, password } = req.body || {};
    const normalizedUsername = String(username || '').trim();
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const error = validateRegisterInput({ username: normalizedUsername, email: normalizedEmail, password });
    if (error) {
      throw new AppError(error, 400, 'INVALID_REGISTER_INPUT');
    }

    const [usernameRows] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [normalizedUsername]);
    if (usernameRows.length > 0) {
      throw new AppError('Username already exists', 409, 'USERNAME_EXISTS');
    }

    const [emailRows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
    if (emailRows.length > 0) {
      throw new AppError('Email already exists', 409, 'EMAIL_EXISTS');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const conn = await pool.getConnection();
    let userId;

    try {
      await conn.beginTransaction();

      const [insertUser] = await conn.query(
        `INSERT INTO users
         (username, email, role, password_hash, points)
         VALUES (?, ?, 'user', ?, ?)`,
        [normalizedUsername, normalizedEmail, passwordHash, config.defaultRegisterPoints],
      );
      userId = insertUser.insertId;

      await conn.query(
        `INSERT INTO points_ledger
         (user_id, change_amount, balance_after, reason, reference_type, reference_id)
         VALUES (?, ?, ?, 'REGISTER_BONUS', 'user', ?)`,
        [userId, config.defaultRegisterPoints, config.defaultRegisterPoints, String(userId)],
      );

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const user = {
      id: userId,
      username: normalizedUsername,
      email: normalizedEmail,
      role: 'user',
      points: config.defaultRegisterPoints,
    };

    const token = signToken(user);
    setAuthCookie(req, res, token);

    res.status(201).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', loginRateLimit, async (req, res, next) => {
  try {
    const { account, password } = req.body || {};
    if (!account || !password) {
      throw new AppError('account and password are required', 400, 'INVALID_LOGIN_INPUT');
    }

    const normalized = String(account).trim();
    const [rows] = await pool.query(
      'SELECT id, username, email, role, password_hash, points, is_active FROM users WHERE username = ? OR email = ? LIMIT 1',
      [normalized, normalized.toLowerCase()],
    );

    if (rows.length === 0) {
      throw new AppError('Invalid account or password', 401, 'AUTH_FAILED');
    }

    const user = rows[0];
    if (!user.is_active) {
      throw new AppError('User is disabled', 403, 'USER_DISABLED');
    }

    const matched = await bcrypt.compare(password, user.password_hash);
    if (!matched) {
      throw new AppError('Invalid account or password', 401, 'AUTH_FAILED');
    }

    const token = signToken(user);
    setAuthCookie(req, res, token);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role || 'user',
          points: user.points,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  const secure = isSecureRequest(req);
  res.clearCookie('aft_token', {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  });
  res.json({ success: true });
});

module.exports = router;
