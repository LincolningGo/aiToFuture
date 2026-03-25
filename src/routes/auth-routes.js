const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { pool } = require('../db/mysql');
const { AppError } = require('../utils/errors');
const { validateRegisterInput } = require('../utils/validators');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      email: user.email,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
}

function setAuthCookie(res, token) {
  res.cookie('aft_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body || {};
    const error = validateRegisterInput({ username, email, password });
    if (error) {
      throw new AppError(error, 400, 'INVALID_REGISTER_INPUT');
    }

    const normalizedEmail = email.trim().toLowerCase();

    const [existsRows] = await pool.query(
      'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
      [username, normalizedEmail],
    );
    if (existsRows.length > 0) {
      throw new AppError('Username or email already exists', 409, 'USER_EXISTS');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const conn = await pool.getConnection();
    let userId;

    try {
      await conn.beginTransaction();

      const [insertUser] = await conn.query(
        `INSERT INTO users
         (username, email, password_hash, points)
         VALUES (?, ?, ?, ?)`,
        [username, normalizedEmail, passwordHash, config.defaultRegisterPoints],
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
      username,
      email: normalizedEmail,
      points: config.defaultRegisterPoints,
    };

    const token = signToken(user);
    setAuthCookie(res, token);

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

router.post('/login', async (req, res, next) => {
  try {
    const { account, password } = req.body || {};
    if (!account || !password) {
      throw new AppError('account and password are required', 400, 'INVALID_LOGIN_INPUT');
    }

    const normalized = String(account).trim();
    const [rows] = await pool.query(
      'SELECT id, username, email, password_hash, points, is_active FROM users WHERE username = ? OR email = ? LIMIT 1',
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
    setAuthCookie(res, token);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          points: user.points,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('aft_token');
  res.json({ success: true });
});

module.exports = router;
