const express = require('express');
const { pool } = require('../db/mysql');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const { AppError } = require('../utils/errors');

const router = express.Router();

function normalizePage(value, fallback = 1) {
  return Math.max(Number.parseInt(value, 10) || fallback, 1);
}

function normalizeLimit(value, fallback = 10, max = 100) {
  return Math.min(Math.max(Number.parseInt(value, 10) || fallback, 1), max);
}

function toBooleanStrict(value) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return null;
}

router.use(requireAuth, requireSuperAdmin);

router.get('/users', async (req, res, next) => {
  try {
    const page = normalizePage(req.query.page, 1);
    const limit = normalizeLimit(req.query.limit, 10, 100);
    const offset = (page - 1) * limit;
    const query = String(req.query.query || '').trim();
    const role = String(req.query.role || '').trim();
    const status = String(req.query.status || '').trim();

    const whereParts = [];
    const params = [];

    if (query) {
      const likeValue = `%${query}%`;
      if (/^\d+$/.test(query)) {
        whereParts.push('(id = ? OR username LIKE ? OR email LIKE ?)');
        params.push(Number(query), likeValue, likeValue);
      } else {
        whereParts.push('(username LIKE ? OR email LIKE ?)');
        params.push(likeValue, likeValue);
      }
    }

    if (role) {
      const allowedRoles = new Set(['user', 'super_admin']);
      if (!allowedRoles.has(role)) {
        throw new AppError('Invalid role filter', 400, 'INVALID_ROLE_FILTER');
      }
      whereParts.push('role = ?');
      params.push(role);
    }

    if (status) {
      if (status === 'active') {
        whereParts.push('is_active = 1');
      } else if (status === 'disabled') {
        whereParts.push('is_active = 0');
      } else {
        throw new AppError('Invalid status filter', 400, 'INVALID_STATUS_FILTER');
      }
    }

    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const [[summaryRow]] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_total,
              SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS disabled_total,
              SUM(CASE WHEN role = 'super_admin' THEN 1 ELSE 0 END) AS super_admin_total
       FROM users`,
    );

    const [[totalRow]] = await pool.query(`SELECT COUNT(*) AS total FROM users ${whereSql}`, params);
    const [rows] = await pool.query(
      `SELECT id, username, email, role, points, is_active, created_at, updated_at
       FROM users
       ${whereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const total = Number(totalRow?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.json({
      success: true,
      data: {
        items: rows.map((row) => ({
          id: row.id,
          username: row.username,
          email: row.email,
          role: row.role,
          points: row.points,
          is_active: Boolean(row.is_active),
          created_at: row.created_at,
          updated_at: row.updated_at,
        })),
        pagination: {
          page: Math.min(page, totalPages),
          limit,
          total,
          totalPages,
        },
        summary: {
          total: Number(summaryRow?.total || 0),
          activeTotal: Number(summaryRow?.active_total || 0),
          disabledTotal: Number(summaryRow?.disabled_total || 0),
          superAdminTotal: Number(summaryRow?.super_admin_total || 0),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/users/:userId/status', async (req, res, next) => {
  const targetUserId = Number.parseInt(req.params.userId, 10);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return next(new AppError('Invalid user id', 400, 'INVALID_USER_ID'));
  }

  try {
    const isActive = toBooleanStrict(req.body?.isActive);
    if (isActive === null) {
      throw new AppError('isActive must be a boolean', 400, 'INVALID_STATUS_INPUT');
    }
    if (targetUserId === req.auth.userId && isActive === false) {
      throw new AppError('You cannot disable your own account', 400, 'CANNOT_DISABLE_SELF');
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query(
        'SELECT id, username, role, is_active FROM users WHERE id = ? LIMIT 1 FOR UPDATE',
        [targetUserId],
      );
      if (rows.length === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const user = rows[0];
      const beforeValue = Number(user.is_active ? 1 : 0);
      const afterValue = Number(isActive ? 1 : 0);

      if (beforeValue !== afterValue) {
        await conn.query('UPDATE users SET is_active = ? WHERE id = ?', [afterValue, targetUserId]);
      }

      await conn.query(
        `INSERT INTO admin_action_logs
         (admin_user_id, target_user_id, action_type, change_amount, before_value, after_value, note)
         VALUES (?, ?, ?, NULL, ?, ?, ?)`,
        [
          req.auth.userId,
          targetUserId,
          afterValue === 1 ? 'enable_user' : 'disable_user',
          beforeValue,
          afterValue,
          `Set user status to ${afterValue === 1 ? 'active' : 'disabled'}`,
        ],
      );

      await conn.commit();

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            is_active: Boolean(afterValue),
          },
        },
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
});

router.post('/users/:userId/points', async (req, res, next) => {
  const targetUserId = Number.parseInt(req.params.userId, 10);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return next(new AppError('Invalid user id', 400, 'INVALID_USER_ID'));
  }

  try {
    const action = String(req.body?.action || '').trim();
    const amount = Number.parseInt(req.body?.amount, 10);
    const note = String(req.body?.reason || '').trim();

    if (!['grant', 'deduct'].includes(action)) {
      throw new AppError('action must be grant or deduct', 400, 'INVALID_POINTS_ACTION');
    }
    if (!Number.isInteger(amount) || amount <= 0 || amount > 1000000) {
      throw new AppError('amount must be between 1 and 1000000', 400, 'INVALID_POINTS_AMOUNT');
    }
    if (note.length < 2 || note.length > 255) {
      throw new AppError('reason length must be 2-255', 400, 'INVALID_POINTS_REASON');
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query(
        'SELECT id, username, points, is_active FROM users WHERE id = ? LIMIT 1 FOR UPDATE',
        [targetUserId],
      );
      if (rows.length === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const user = rows[0];
      const beforeValue = Number(user.points || 0);
      const delta = action === 'grant' ? amount : -amount;
      const afterValue = beforeValue + delta;

      if (afterValue < 0) {
        throw new AppError('User points cannot be negative', 400, 'POINTS_INSUFFICIENT');
      }

      await conn.query('UPDATE users SET points = ? WHERE id = ?', [afterValue, targetUserId]);

      const [actionResult] = await conn.query(
        `INSERT INTO admin_action_logs
         (admin_user_id, target_user_id, action_type, change_amount, before_value, after_value, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          req.auth.userId,
          targetUserId,
          action === 'grant' ? 'grant_points' : 'deduct_points',
          delta,
          beforeValue,
          afterValue,
          note,
        ],
      );

      await conn.query(
        `INSERT INTO points_ledger
         (user_id, change_amount, balance_after, reason, reference_type, reference_id)
         VALUES (?, ?, ?, ?, 'admin_action', ?)`,
        [
          targetUserId,
          delta,
          afterValue,
          action === 'grant' ? 'ADMIN_GRANT' : 'ADMIN_DEDUCT',
          String(actionResult.insertId),
        ],
      );

      await conn.commit();

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            points: afterValue,
            is_active: Boolean(user.is_active),
          },
        },
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
