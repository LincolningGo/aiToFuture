const express = require('express');
const { pool } = require('../db/mysql');
const { requireAuth } = require('../middleware/auth');
const { AppError } = require('../utils/errors');

const router = express.Router();

function normalizeJobUuid(value) {
  const uuid = String(value || '').trim();
  if (!uuid || uuid.length > 64) {
    throw new AppError('Invalid job uuid', 400, 'INVALID_JOB_UUID');
  }
  return uuid;
}

function toBooleanStrict(value) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return null;
}

router.put('/jobs/:jobUuid/favorite', requireAuth, async (req, res, next) => {
  try {
    const jobUuid = normalizeJobUuid(req.params.jobUuid);
    const favorite = toBooleanStrict(req.body?.favorite);
    if (favorite === null) {
      throw new AppError('favorite must be a boolean', 400, 'INVALID_FAVORITE_INPUT');
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [jobRows] = await conn.query(
        'SELECT id FROM generation_jobs WHERE job_uuid = ? AND user_id = ? LIMIT 1 FOR UPDATE',
        [jobUuid, req.auth.userId],
      );
      if (jobRows.length === 0) {
        throw new AppError('Job not found', 404, 'JOB_NOT_FOUND');
      }

      if (favorite) {
        await conn.query(
          'INSERT IGNORE INTO favorites (user_id, job_uuid) VALUES (?, ?)',
          [req.auth.userId, jobUuid],
        );
      } else {
        await conn.query('DELETE FROM favorites WHERE user_id = ? AND job_uuid = ?', [req.auth.userId, jobUuid]);
      }

      await conn.commit();
      res.json({ success: true, data: { jobUuid, favorite } });
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

