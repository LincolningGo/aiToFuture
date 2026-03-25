const express = require('express');
const config = require('../config');
const { pool } = require('../db/mysql');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/active', requireAuth, async (req, res, next) => {
  try {
    const capability = req.query.capability ? String(req.query.capability).trim() : null;
    const supported = new Set([
      'text_to_image',
      'image_to_image',
      'text_to_video',
      'text_to_audio',
      'lyrics_generation',
      'music_generation',
    ]);
    const hiddenLegacyCodes = ['minimax-image-01', 'minimax-image-edit-01', 'minimax-video-01', 'minimax-voice-01'];

    const whereParts = ['is_active = 1'];
    const params = [];

    whereParts.push('provider <> ?');
    params.push('minimax_mock');
    whereParts.push(`NOT (provider = ? AND model_code IN (${hiddenLegacyCodes.map(() => '?').join(', ')}))`);
    params.push('minimax', ...hiddenLegacyCodes);

    if (capability) {
      if (!supported.has(capability)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_CAPABILITY', message: 'Invalid capability' },
        });
      }
      whereParts.push('capability = ?');
      params.push(capability);
    }

    const [rows] = await pool.query(
      `SELECT id, provider, capability, model_code, model_name, unit_cost_points, is_default, updated_at
       FROM ai_models
       WHERE ${whereParts.join(' AND ')}
       ORDER BY capability ASC, (provider = ?) DESC, is_default DESC, id ASC`,
      [...params, config.aiProvider],
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
