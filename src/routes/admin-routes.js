const express = require('express');
const { pool } = require('../db/mysql');
const { requireAuth, requireSuperAdmin } = require('../middleware/auth');
const { AppError } = require('../utils/errors');
const { getSystemSettings, updateSystemSettings } = require('../services/system-settings');

const router = express.Router();
const USER_ROLES = new Set(['user', 'super_admin']);
const ADMIN_ACTION_TYPES = new Set([
  'grant_points',
  'deduct_points',
  'enable_user',
  'disable_user',
  'change_role',
  'update_system_settings',
]);

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
      if (!USER_ROLES.has(role)) {
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

router.get('/action-logs', async (req, res, next) => {
  try {
    const page = normalizePage(req.query.page, 1);
    const limit = normalizeLimit(req.query.limit, 10, 100);
    const offset = (page - 1) * limit;
    const query = String(req.query.query || '').trim();
    const actionType = String(req.query.actionType || '').trim();

    const whereParts = [];
    const params = [];

    if (actionType) {
      if (!ADMIN_ACTION_TYPES.has(actionType)) {
        throw new AppError('Invalid action type filter', 400, 'INVALID_ACTION_TYPE_FILTER');
      }
      whereParts.push('l.action_type = ?');
      params.push(actionType);
    }

    if (query) {
      const likeValue = `%${query}%`;
      if (/^\d+$/.test(query)) {
        whereParts.push(
          '(l.id = ? OR admin_u.id = ? OR target_u.id = ? OR admin_u.username LIKE ? OR admin_u.email LIKE ? OR target_u.username LIKE ? OR target_u.email LIKE ? OR l.note LIKE ?)',
        );
        params.push(Number(query), Number(query), Number(query), likeValue, likeValue, likeValue, likeValue, likeValue);
      } else {
        whereParts.push(
          '(admin_u.username LIKE ? OR admin_u.email LIKE ? OR target_u.username LIKE ? OR target_u.email LIKE ? OR l.note LIKE ?)',
        );
        params.push(likeValue, likeValue, likeValue, likeValue, likeValue);
      }
    }

    const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM admin_action_logs l
       INNER JOIN users admin_u ON admin_u.id = l.admin_user_id
       INNER JOIN users target_u ON target_u.id = l.target_user_id
       ${whereSql}`,
      params,
    );

    const [rows] = await pool.query(
      `SELECT l.id, l.action_type, l.change_amount, l.before_value, l.after_value, l.note, l.created_at,
              admin_u.id AS admin_user_id, admin_u.username AS admin_username, admin_u.email AS admin_email,
              target_u.id AS target_user_id, target_u.username AS target_username, target_u.email AS target_email
       FROM admin_action_logs l
       INNER JOIN users admin_u ON admin_u.id = l.admin_user_id
       INNER JOIN users target_u ON target_u.id = l.target_user_id
       ${whereSql}
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const total = Number(countRows?.[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.json({
      success: true,
      data: {
        items: rows.map((row) => ({
          id: row.id,
          action_type: row.action_type,
          change_amount: row.change_amount,
          before_value: row.before_value,
          after_value: row.after_value,
          note: row.note,
          created_at: row.created_at,
          admin_user: {
            id: row.admin_user_id,
            username: row.admin_username,
            email: row.admin_email,
          },
          target_user: {
            id: row.target_user_id,
            username: row.target_username,
            email: row.target_email,
          },
        })),
        pagination: {
          page: Math.min(page, totalPages),
          limit,
          total,
          totalPages,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/system-settings', async (_req, res, next) => {
  try {
    const systemSettings = await getSystemSettings();
    res.json({
      success: true,
      data: systemSettings,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/system-settings', async (req, res, next) => {
  try {
    const registerEnabled = toBooleanStrict(req.body?.registerEnabled);
    const registerBonusPoints = Number.parseInt(req.body?.registerBonusPoints, 10);

    if (registerEnabled === null) {
      throw new AppError('registerEnabled must be a boolean', 400, 'INVALID_REGISTER_ENABLED');
    }
    if (!Number.isInteger(registerBonusPoints) || registerBonusPoints < 0 || registerBonusPoints > 1000000) {
      throw new AppError(
        'registerBonusPoints must be between 0 and 1000000',
        400,
        'INVALID_REGISTER_BONUS_POINTS',
      );
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const beforeSettings = await getSystemSettings(conn);
      const nextSettings = await updateSystemSettings({ registerEnabled, registerBonusPoints }, conn);

      const changed =
        beforeSettings.registerEnabled !== nextSettings.registerEnabled ||
        beforeSettings.registerBonusPoints !== nextSettings.registerBonusPoints;

      if (changed) {
        const note = [
          `registerEnabled: ${beforeSettings.registerEnabled ? 'on' : 'off'} -> ${nextSettings.registerEnabled ? 'on' : 'off'}`,
          `registerBonusPoints: ${beforeSettings.registerBonusPoints} -> ${nextSettings.registerBonusPoints}`,
        ].join(' | ');

        await conn.query(
          `INSERT INTO admin_action_logs
           (admin_user_id, target_user_id, action_type, change_amount, before_value, after_value, note)
           VALUES (?, ?, 'update_system_settings', NULL, NULL, NULL, ?)`,
          [req.auth.userId, req.auth.userId, note.slice(0, 255)],
        );
      }

      await conn.commit();

      res.json({
        success: true,
        data: {
          changed,
          ...nextSettings,
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

router.get('/users/:userId', async (req, res, next) => {
  const targetUserId = Number.parseInt(req.params.userId, 10);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return next(new AppError('Invalid user id', 400, 'INVALID_USER_ID'));
  }

  try {
    const [userRows] = await pool.query(
      'SELECT id, username, email, role, points, is_active, created_at, updated_at FROM users WHERE id = ? LIMIT 1',
      [targetUserId],
    );
    if (userRows.length === 0) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const [[generationTotalRow]] = await pool.query(
      'SELECT COUNT(*) AS total FROM generation_jobs WHERE user_id = ?',
      [targetUserId],
    );
    const [[ledgerTotalRow]] = await pool.query(
      'SELECT COUNT(*) AS total FROM points_ledger WHERE user_id = ?',
      [targetUserId],
    );

    const [ledgerRows] = await pool.query(
      `SELECT change_amount, balance_after, reason, reference_type, reference_id, created_at
       FROM points_ledger
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 8`,
      [targetUserId],
    );

    const [generationRows] = await pool.query(
      `SELECT j.job_uuid, j.capability, j.provider, j.model_code, j.model_name,
              j.status, j.cost_points, j.prompt_text, j.error_message, j.created_at,
              o.file_type, o.public_url, o.metadata_json AS output_metadata
       FROM generation_jobs j
       LEFT JOIN generation_outputs o ON o.job_id = j.id
       WHERE j.user_id = ?
       ORDER BY j.created_at DESC
       LIMIT 6`,
      [targetUserId],
    );

    const recentGenerations = generationRows.map((row) => {
      let outputPreviewText = null;
      if (row.output_metadata) {
        try {
          const metadata =
            typeof row.output_metadata === 'string' ? JSON.parse(row.output_metadata) : row.output_metadata;
          if (metadata && typeof metadata.textPreview === 'string' && metadata.textPreview.trim()) {
            outputPreviewText = metadata.textPreview.trim();
          }
        } catch (_err) {
          outputPreviewText = null;
        }
      }

      return {
        job_uuid: row.job_uuid,
        capability: row.capability,
        provider: row.provider,
        model_code: row.model_code,
        model_name: row.model_name,
        status: row.status,
        cost_points: row.cost_points,
        prompt_text: row.prompt_text,
        error_message: row.error_message,
        created_at: row.created_at,
        file_type: row.file_type,
        public_url: row.public_url,
        output_preview_text: outputPreviewText,
      };
    });

    res.json({
      success: true,
      data: {
        user: {
          ...userRows[0],
          is_active: Boolean(userRows[0].is_active),
        },
        summary: {
          generationTotal: Number(generationTotalRow?.total || 0),
          ledgerTotal: Number(ledgerTotalRow?.total || 0),
        },
        recentLedger: ledgerRows,
        recentGenerations,
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

router.patch('/users/:userId/role', async (req, res, next) => {
  const targetUserId = Number.parseInt(req.params.userId, 10);
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    return next(new AppError('Invalid user id', 400, 'INVALID_USER_ID'));
  }

  try {
    const role = String(req.body?.role || '').trim();
    const reason = String(req.body?.reason || '').trim();

    if (!USER_ROLES.has(role)) {
      throw new AppError('Invalid role', 400, 'INVALID_ROLE');
    }
    if (reason.length > 255) {
      throw new AppError('reason length must be 0-255', 400, 'INVALID_ROLE_REASON');
    }
    if (targetUserId === req.auth.userId && role !== 'super_admin') {
      throw new AppError('You cannot downgrade your own account', 400, 'CANNOT_DOWNGRADE_SELF');
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query(
        'SELECT id, username, role FROM users WHERE id = ? LIMIT 1 FOR UPDATE',
        [targetUserId],
      );
      if (rows.length === 0) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const user = rows[0];
      const beforeRole = String(user.role || 'user');
      const afterRole = role;
      const changed = beforeRole !== afterRole;

      if (changed) {
        await conn.query('UPDATE users SET role = ? WHERE id = ?', [afterRole, targetUserId]);
        await conn.query(
          `INSERT INTO admin_action_logs
           (admin_user_id, target_user_id, action_type, change_amount, before_value, after_value, note)
           VALUES (?, ?, 'change_role', NULL, NULL, NULL, ?)`,
          [
            req.auth.userId,
            targetUserId,
            `Role ${beforeRole} -> ${afterRole}${reason ? ` | ${reason}` : ''}`.slice(0, 255),
          ],
        );
      }

      await conn.commit();

      res.json({
        success: true,
        data: {
          changed,
          user: {
            id: user.id,
            username: user.username,
            role: afterRole,
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
