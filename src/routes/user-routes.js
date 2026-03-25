const express = require('express');
const { pool } = require('../db/mysql');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, email, points, created_at FROM users WHERE id = ? LIMIT 1',
      [req.auth.userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    const [costRows] = await pool.query('SELECT capability, cost_points FROM generation_cost_rules');

    res.json({
      success: true,
      data: {
        user: rows[0],
        costs: costRows,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/points-ledger', requireAuth, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const [rows] = await pool.query(
      `SELECT change_amount, balance_after, reason, reference_type, reference_id, created_at
       FROM points_ledger
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [req.auth.userId, limit],
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
