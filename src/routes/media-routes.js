const fs = require('fs/promises');
const express = require('express');
const path = require('path');
const config = require('../config');
const { pool } = require('../db/mysql');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/*', requireAuth, async (req, res, next) => {
  try {
    const requestPath = `/generated/${req.params[0]}`;
    const isSuperAdmin = req.auth?.role === 'super_admin';
    const sql = isSuperAdmin
      ? `SELECT o.local_path
         FROM generation_outputs o
         JOIN generation_jobs j ON j.id = o.job_id
         WHERE o.public_url = ?
         LIMIT 1`
      : `SELECT o.local_path
         FROM generation_outputs o
         JOIN generation_jobs j ON j.id = o.job_id
         WHERE o.public_url = ? AND j.user_id = ?
         LIMIT 1`;
    const params = isSuperAdmin ? [requestPath] : [requestPath, req.auth.userId];
    const [rows] = await pool.query(sql, params);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
    }

    const absolutePath = path.resolve(rows[0].local_path);
    const storageRoot = path.resolve(config.storageRoot);
    if (!absolutePath.startsWith(`${storageRoot}${path.sep}`) && absolutePath !== storageRoot) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    await fs.access(absolutePath);
    res.set('Cache-Control', 'private, no-store');
    return res.sendFile(absolutePath);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
    }
    return next(err);
  }
});

module.exports = router;
