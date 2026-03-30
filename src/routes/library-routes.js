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

function normalizeTagName(value) {
  const name = String(value || '').trim();
  if (!name || name.length > 32) {
    throw new AppError('Tag name length must be 1-32', 400, 'INVALID_TAG_NAME');
  }
  return name;
}

function normalizeTagIds(value) {
  if (!Array.isArray(value)) {
    throw new AppError('tagIds must be an array', 400, 'INVALID_TAG_IDS');
  }
  const ids = [...new Set(value.map((item) => Number.parseInt(item, 10)).filter((item) => Number.isInteger(item) && item > 0))];
  if (ids.length !== value.length) {
    throw new AppError('tagIds must contain valid positive integers', 400, 'INVALID_TAG_IDS');
  }
  return ids;
}

router.get('/tags', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.id, t.name, t.color, t.created_at, COUNT(jt.job_uuid) AS job_total
       FROM tags t
       LEFT JOIN job_tags jt ON jt.tag_id = t.id
       WHERE t.user_id = ?
       GROUP BY t.id, t.name, t.color, t.created_at
       ORDER BY t.created_at DESC, t.id DESC`,
      [req.auth.userId],
    );

    res.json({
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        name: row.name,
        color: row.color,
        created_at: row.created_at,
        job_total: Number(row.job_total || 0),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/tags', requireAuth, async (req, res, next) => {
  try {
    const name = normalizeTagName(req.body?.name);
    const color = req.body?.color ? String(req.body.color).trim().slice(0, 16) : null;

    const [result] = await pool.query(
      'INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)',
      [req.auth.userId, name, color || null],
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        name,
        color: color || null,
        job_total: 0,
      },
    });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return next(new AppError('Tag already exists', 409, 'TAG_EXISTS'));
    }
    return next(err);
  }
});

router.delete('/tags/:tagId', requireAuth, async (req, res, next) => {
  try {
    const tagId = Number.parseInt(req.params.tagId, 10);
    if (!Number.isInteger(tagId) || tagId <= 0) {
      throw new AppError('Invalid tag id', 400, 'INVALID_TAG_ID');
    }

    const [result] = await pool.query('DELETE FROM tags WHERE id = ? AND user_id = ?', [tagId, req.auth.userId]);
    if (result.affectedRows === 0) {
      throw new AppError('Tag not found', 404, 'TAG_NOT_FOUND');
    }

    res.json({ success: true, data: { tagId } });
  } catch (err) {
    next(err);
  }
});

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

router.put('/jobs/:jobUuid/tags', requireAuth, async (req, res, next) => {
  try {
    const jobUuid = normalizeJobUuid(req.params.jobUuid);
    const tagIds = normalizeTagIds(req.body?.tagIds || []);

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

      if (tagIds.length > 0) {
        const placeholders = tagIds.map(() => '?').join(', ');
        const [tagRows] = await conn.query(
          `SELECT id
           FROM tags
           WHERE user_id = ? AND id IN (${placeholders})`,
          [req.auth.userId, ...tagIds],
        );
        if (tagRows.length !== tagIds.length) {
          throw new AppError('Some tags do not exist', 400, 'TAG_NOT_FOUND');
        }
      }

      await conn.query('DELETE FROM job_tags WHERE job_uuid = ?', [jobUuid]);
      if (tagIds.length > 0) {
        await conn.query(
          `INSERT INTO job_tags (tag_id, job_uuid)
           VALUES ${tagIds.map(() => '(?, ?)').join(', ')}`,
          tagIds.flatMap((tagId) => [tagId, jobUuid]),
        );
      }

      await conn.commit();
      res.json({ success: true, data: { jobUuid, tagIds } });
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
