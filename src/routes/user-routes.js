const express = require('express');
const { pool } = require('../db/mysql');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, email, role, points, created_at FROM users WHERE id = ? LIMIT 1',
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
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;

    const [[totalRow]] = await pool.query('SELECT COUNT(*) AS total FROM points_ledger WHERE user_id = ?', [req.auth.userId]);
    const [rows] = await pool.query(
      `SELECT change_amount, balance_after, reason, reference_type, reference_id, created_at
       FROM points_ledger
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [req.auth.userId, limit, offset],
    );

    res.json({
      success: true,
      data: {
        items: rows,
        pagination: {
          page,
          limit,
          total: Number(totalRow?.total || 0),
          totalPages: Math.max(1, Math.ceil(Number(totalRow?.total || 0) / limit)),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
