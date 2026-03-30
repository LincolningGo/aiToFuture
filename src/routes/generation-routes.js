const express = require('express');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');
const { createRateLimit } = require('../middleware/rate-limit');
const { validateGenerationInput } = require('../utils/validators');
const { AppError } = require('../utils/errors');
const { submitGeneration, listJobs } = require('../services/generation-service');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const generationRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  max: 12,
  message: 'Too many generation requests, please slow down',
  keyPrefix: 'generation',
});

router.post('/submit', requireAuth, generationRateLimit, async (req, res, next) => {
  try {
    const payload = {
      capability: req.body.capability,
      prompt: req.body.prompt,
      modelCode: req.body.modelCode,
      inputImageBase64: req.body.inputImageBase64,
      lyrics: req.body.lyrics,
      isInstrumental: req.body.isInstrumental === true || req.body.isInstrumental === 'true',
    };

    const error = validateGenerationInput(payload);
    if (error) throw new AppError(error, 400, 'INVALID_GENERATION_INPUT');

    const result = await submitGeneration({
      userId: req.auth.userId,
      capability: payload.capability,
      prompt: payload.prompt,
      modelCode: payload.modelCode,
      inputImageBase64: payload.inputImageBase64,
      lyrics: payload.lyrics,
      isInstrumental: payload.isInstrumental,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/submit-with-file', requireAuth, generationRateLimit, upload.single('inputImage'), async (req, res, next) => {
  try {
    if (req.file && String(req.file.mimetype || '').startsWith('image/') === false) {
      throw new AppError('Only image uploads are allowed', 400, 'INVALID_FILE_TYPE');
    }

    const capability = req.body.capability;
    const prompt = req.body.prompt;
    const modelCode = req.body.modelCode;
    const inputImageBase64 = req.file ? req.file.buffer.toString('base64') : null;
    const lyrics = req.body.lyrics;
    const isInstrumental = req.body.isInstrumental === true || req.body.isInstrumental === 'true';

    const payload = { capability, prompt, modelCode, inputImageBase64, lyrics, isInstrumental };
    const error = validateGenerationInput(payload);
    if (error) throw new AppError(error, 400, 'INVALID_GENERATION_INPUT');

    const result = await submitGeneration({
      userId: req.auth.userId,
      capability,
      prompt,
      modelCode,
      inputImageBase64,
      lyrics,
      isInstrumental,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/history', requireAuth, async (req, res, next) => {
  try {
    const result = await listJobs(req.auth.userId, {
      limit: req.query.limit,
      page: req.query.page,
      query: req.query.q,
      capability: req.query.capability,
      status: req.query.status,
      favoriteOnly: req.query.favorite === '1' || req.query.favorite === 'true',
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
