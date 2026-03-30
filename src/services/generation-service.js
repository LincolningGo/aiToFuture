const fs = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { pool } = require('../db/mysql');
const { AppError } = require('../utils/errors');
const { generateContent } = require('./provider/minimax-adapter');

const QUEUE_CONCURRENCY = Math.max(1, Number(process.env.GENERATION_QUEUE_CONCURRENCY || 2));
const MAX_INPUT_IMAGE_BYTES = 10 * 1024 * 1024;
const generationQueue = [];
let activeWorkers = 0;

function getDateBucket() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function normalizeBase64(input) {
  if (!input) return null;
  const stripped = String(input)
    .trim()
    .replace(/^data:[^;]+;base64,/i, '')
    .replace(/\s+/g, '');

  if (!stripped) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(stripped) || stripped.length % 4 === 1) {
    throw new AppError('Invalid base64 image payload', 400, 'INVALID_IMAGE_PAYLOAD');
  }

  const buffer = Buffer.from(stripped, 'base64');
  if (!buffer.length) {
    throw new AppError('Invalid base64 image payload', 400, 'INVALID_IMAGE_PAYLOAD');
  }
  return buffer;
}

function detectImageInfo(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { extension: 'png', mimeType: 'image/png' };
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: 'jpg', mimeType: 'image/jpeg' };
  }

  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { extension: 'webp', mimeType: 'image/webp' };
  }

  if (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a') {
    return { extension: 'gif', mimeType: 'image/gif' };
  }

  return null;
}

async function getCostPoints(capability) {
  const [rows] = await pool.query(
    'SELECT cost_points FROM generation_cost_rules WHERE capability = ? LIMIT 1',
    [capability],
  );
  if (rows.length > 0) return rows[0].cost_points;
  return config.costs[capability] || 0;
}

async function resolveModel(capability, modelCode) {
  const params = [capability];
  let sql = `SELECT id, provider, capability, model_code, model_name, unit_cost_points, is_default
             FROM ai_models
             WHERE capability = ? AND is_active = 1`;

  if (modelCode) {
    sql += ' AND model_code = ?';
    params.push(modelCode.trim());
  }

  sql += ' ORDER BY (provider = ?) DESC, is_default DESC, id ASC LIMIT 1';
  params.push(config.aiProvider);

  const [rows] = await pool.query(sql, params);
  if (rows.length === 0) {
    throw new AppError(
      modelCode
        ? `Model not found or disabled: ${modelCode}`
        : `No active model configured for capability: ${capability}`,
      400,
      'MODEL_NOT_CONFIGURED',
    );
  }

  return rows[0];
}

async function deductPointsAndCreateJob({ userId, capability, model, prompt, costPoints, inputImagePath }) {
  const conn = await pool.getConnection();
  const jobUuid = uuidv4();
  let jobId;

  try {
    await conn.beginTransaction();

    const [userRows] = await conn.query('SELECT points FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (userRows.length === 0) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const currentPoints = userRows[0].points;
    if (currentPoints < costPoints) {
      throw new AppError('Insufficient points', 400, 'INSUFFICIENT_POINTS');
    }

    const balanceAfter = currentPoints - costPoints;

    const [jobResult] = await conn.query(
      `INSERT INTO generation_jobs
       (job_uuid, user_id, model_id, capability, provider, model_code, model_name, prompt_text, input_image_path, status, cost_points)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)`,
      [
        jobUuid,
        userId,
        model.id,
        capability,
        config.aiProvider,
        model.model_code,
        model.model_name,
        prompt,
        inputImagePath || null,
        costPoints,
      ],
    );
    jobId = jobResult.insertId;

    await conn.query('UPDATE users SET points = ? WHERE id = ?', [balanceAfter, userId]);

    await conn.query(
      `INSERT INTO points_ledger
       (user_id, change_amount, balance_after, reason, reference_type, reference_id)
       VALUES (?, ?, ?, 'GENERATION_COST', 'generation_job', ?)`,
      [userId, -costPoints, balanceAfter, jobUuid],
    );

    await conn.commit();
    return { jobId, jobUuid };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function refundPoints({ userId, jobUuid, costPoints }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [userRows] = await conn.query('SELECT points FROM users WHERE id = ? FOR UPDATE', [userId]);
    if (userRows.length === 0) {
      await conn.rollback();
      return;
    }

    const balanceAfter = userRows[0].points + costPoints;
    await conn.query('UPDATE users SET points = ? WHERE id = ?', [balanceAfter, userId]);

    await conn.query(
      `INSERT INTO points_ledger
       (user_id, change_amount, balance_after, reason, reference_type, reference_id)
       VALUES (?, ?, ?, 'GENERATION_REFUND', 'generation_job', ?)`,
      [userId, costPoints, balanceAfter, jobUuid],
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    console.error('[REFUND_ERROR]', err);
  } finally {
    conn.release();
  }
}

async function markProcessing(jobUuid) {
  await pool.query('UPDATE generation_jobs SET status = ?, error_message = NULL WHERE job_uuid = ?', ['processing', jobUuid]);
}

async function markFailed(jobUuid, message) {
  await pool.query('UPDATE generation_jobs SET status = ?, error_message = ? WHERE job_uuid = ?', [
    'failed',
    message,
    jobUuid,
  ]);
}

async function persistOutput({ userId, jobId, jobUuid, output }) {
  const dateBucket = getDateBucket();
  const targetDir = path.join(config.storageRoot, dateBucket);
  await fs.mkdir(targetDir, { recursive: true });

  const filename = `${jobUuid}.${output.extension}`;
  const absolutePath = path.join(targetDir, filename);
  await fs.writeFile(absolutePath, output.buffer);

  const publicUrl = `/generated/${dateBucket}/${filename}`;

  await pool.query(
    `INSERT INTO generation_outputs
     (job_id, file_type, local_path, public_url, metadata_json)
     VALUES (?, ?, ?, ?, ?)`,
    [jobId, output.fileType, absolutePath, publicUrl, JSON.stringify(output.metadata || {})],
  );

  await pool.query('UPDATE generation_jobs SET status = ? WHERE id = ?', ['completed', jobId]);

  return {
    fileType: output.fileType,
    localPath: absolutePath,
    publicUrl,
  };
}

function enqueueGenerationTask(task) {
  generationQueue.push(task);
  pumpQueue();
}

function pumpQueue() {
  while (activeWorkers < QUEUE_CONCURRENCY && generationQueue.length > 0) {
    const task = generationQueue.shift();
    activeWorkers += 1;
    void processGenerationTask(task).finally(() => {
      activeWorkers -= 1;
      pumpQueue();
    });
  }
}

async function processGenerationTask(task) {
  const { userId, jobId, jobUuid, costPoints, providerPayload } = task;
  try {
    await markProcessing(jobUuid);
    const output = await generateContent(providerPayload);
    await persistOutput({
      userId,
      jobId,
      jobUuid,
      output,
    });
  } catch (err) {
    await markFailed(jobUuid, err.message || 'Generation failed');
    await refundPoints({ userId, jobUuid, costPoints });
    console.error('[GEN_QUEUE_JOB_ERROR]', { jobUuid, capability: providerPayload.capability }, err);
  }
}

async function submitGeneration({ userId, capability, prompt, modelCode, inputImageBase64, lyrics, isInstrumental }) {
  const inputImageBuffer = normalizeBase64(inputImageBase64);
  const inputImageInfo = inputImageBuffer ? detectImageInfo(inputImageBuffer) : null;
  let inputImagePath = null;
  let inputImagePublicUrl = null;

  if (capability === 'image_to_image' && !inputImageBuffer) {
    throw new AppError('image_to_image requires source image', 400, 'SOURCE_IMAGE_REQUIRED');
  }

  if (inputImageBuffer) {
    if (inputImageBuffer.length > MAX_INPUT_IMAGE_BYTES) {
      throw new AppError('Input image is too large', 400, 'IMAGE_TOO_LARGE');
    }
    if (!inputImageInfo) {
      throw new AppError('Only PNG/JPEG/WEBP/GIF image uploads are allowed', 400, 'INVALID_FILE_TYPE');
    }

    const dateBucket = getDateBucket();
    const inputDir = path.join(config.storageRoot, dateBucket, 'inputs');
    await fs.mkdir(inputDir, { recursive: true });
    const inputName = `${uuidv4()}.${inputImageInfo.extension}`;
    inputImagePath = path.join(inputDir, inputName);
    await fs.writeFile(inputImagePath, inputImageBuffer);

    const appBase = String(config.appBaseUrl || '').replace(/\/+$/, '');
    inputImagePublicUrl = `${appBase}/generated/${dateBucket}/inputs/${inputName}`;
  }

  const model = await resolveModel(capability, modelCode);
  const costPoints = model.unit_cost_points > 0 ? model.unit_cost_points : await getCostPoints(capability);

  const { jobId, jobUuid } = await deductPointsAndCreateJob({
    userId,
    capability,
    model,
    prompt,
    costPoints,
    inputImagePath,
  });

  const providerPayload = {
    capability,
    prompt,
    lyrics,
    isInstrumental,
    inputImageBuffer,
    inputImageMimeType: inputImageInfo?.mimeType || null,
    modelCode: model.model_code,
    modelProvider: model.provider,
    inputImagePublicUrl,
  };

  enqueueGenerationTask({
    userId,
    jobId,
    jobUuid,
    costPoints,
    providerPayload,
  });

  return {
    jobUuid,
    capability,
    model: {
      id: model.id,
      code: model.model_code,
      name: model.model_name,
      provider: model.provider,
    },
    status: 'queued',
    costPoints,
    output: null,
  };
}

async function listJobs(userId, options = {}) {
  const safeLimit = Math.min(Math.max(Number(options.limit) || 10, 1), 100);
  const safePage = Math.max(Number(options.page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const supportedCapabilities = new Set([
    'text_to_image',
    'image_to_image',
    'text_to_video',
    'text_to_audio',
    'lyrics_generation',
    'music_generation',
  ]);
  const supportedStatuses = new Set(['queued', 'processing', 'completed', 'failed']);
  const query = typeof options.query === 'string' ? options.query.trim() : '';
  const capability = typeof options.capability === 'string' ? options.capability.trim() : '';
  const status = typeof options.status === 'string' ? options.status.trim() : '';
  const favoriteOnly = options.favoriteOnly === true;
  const tagIds = Array.isArray(options.tagIds)
    ? [...new Set(options.tagIds.map((item) => Number.parseInt(item, 10)).filter((item) => Number.isInteger(item) && item > 0))]
    : [];

  const whereParts = ['j.user_id = ?'];
  const params = [userId];

  if (capability) {
    if (!supportedCapabilities.has(capability)) {
      throw new AppError('Invalid capability filter', 400, 'INVALID_CAPABILITY_FILTER');
    }
    whereParts.push('j.capability = ?');
    params.push(capability);
  }
  if (status) {
    if (!supportedStatuses.has(status)) {
      throw new AppError('Invalid status filter', 400, 'INVALID_STATUS_FILTER');
    }
    whereParts.push('j.status = ?');
    params.push(status);
  }
  if (query) {
    const likeValue = `%${query}%`;
    whereParts.push('(j.prompt_text LIKE ? OR j.model_name LIKE ? OR j.model_code LIKE ? OR j.job_uuid LIKE ?)');
    params.push(likeValue, likeValue, likeValue, likeValue);
  }
  if (favoriteOnly) {
    whereParts.push('f.job_uuid IS NOT NULL');
  }
  if (tagIds.length > 0) {
    whereParts.push(
      `EXISTS (
        SELECT 1
        FROM job_tags jt_filter
        JOIN tags t_filter ON t_filter.id = jt_filter.tag_id
        WHERE jt_filter.job_uuid = j.job_uuid
          AND t_filter.user_id = ?
          AND jt_filter.tag_id IN (${tagIds.map(() => '?').join(', ')})
      )`,
    );
    params.push(userId, ...tagIds);
  }

  const whereSql = `WHERE ${whereParts.join(' AND ')}`;

  const [[totalRow]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM generation_jobs j
     LEFT JOIN favorites f ON f.user_id = j.user_id AND f.job_uuid = j.job_uuid
     ${whereSql}`,
    params,
  );
  const [[runningRow]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM generation_jobs
     WHERE user_id = ? AND status IN ('queued', 'processing')`,
    [userId],
  );

  const [rows] = await pool.query(
    `SELECT j.job_uuid, j.capability, j.provider, j.model_code, j.model_name,
            j.status, j.cost_points, j.prompt_text, j.error_message, j.created_at,
            o.file_type, o.public_url, o.metadata_json AS output_metadata,
            IF(f.job_uuid IS NULL, 0, 1) AS is_favorite
     FROM generation_jobs j
     LEFT JOIN (
       SELECT job_id, MAX(id) AS max_id
       FROM generation_outputs
       GROUP BY job_id
     ) mo ON mo.job_id = j.id
     LEFT JOIN generation_outputs o ON o.id = mo.max_id
     LEFT JOIN favorites f ON f.user_id = j.user_id AND f.job_uuid = j.job_uuid
     ${whereSql}
     ORDER BY j.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, safeLimit, offset],
  );

  const jobUuids = rows.map((row) => String(row.job_uuid || '')).filter(Boolean);
  const tagsByJobUuid = new Map();
  if (jobUuids.length > 0) {
    const [tagRows] = await pool.query(
      `SELECT jt.job_uuid, t.id, t.name, t.color
       FROM job_tags jt
       JOIN tags t ON t.id = jt.tag_id
       WHERE t.user_id = ? AND jt.job_uuid IN (${jobUuids.map(() => '?').join(', ')})
       ORDER BY t.created_at DESC, t.id DESC`,
      [userId, ...jobUuids],
    );

    tagRows.forEach((row) => {
      const jobUuid = String(row.job_uuid || '');
      if (!tagsByJobUuid.has(jobUuid)) tagsByJobUuid.set(jobUuid, []);
      tagsByJobUuid.get(jobUuid).push({
        id: row.id,
        name: row.name,
        color: row.color,
      });
    });
  }

  const total = Number(totalRow?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));

  return {
    items: rows.map((row) => {
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
        is_favorite: Boolean(row.is_favorite),
        tags: tagsByJobUuid.get(String(row.job_uuid || '')) || [],
      };
    }),
    pagination: {
      page: Math.min(safePage, totalPages),
      limit: safeLimit,
      total,
      totalPages,
    },
    hasRunningJobs: Number(runningRow?.total || 0) > 0,
  };
}

async function recoverInFlightJobsOnStartup(options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 500, 1), 5000);

  const [rows] = await pool.query(
    `SELECT id, job_uuid, user_id, cost_points, status
     FROM generation_jobs
     WHERE status IN ('queued', 'processing')
     ORDER BY created_at ASC
     LIMIT ?`,
    [limit],
  );

  if (!rows.length) {
    return { scanned: 0, completed: 0, failed: 0, refunded: 0 };
  }

  let completed = 0;
  let failed = 0;
  let refunded = 0;

  for (const row of rows) {
    const jobId = Number(row.id);
    const jobUuid = String(row.job_uuid);
    const userId = Number(row.user_id);
    const costPoints = Math.max(Number(row.cost_points) || 0, 0);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [jobRows] = await conn.query(
        `SELECT id, user_id, cost_points, status
         FROM generation_jobs
         WHERE id = ?
         LIMIT 1
         FOR UPDATE`,
        [jobId],
      );

      if (jobRows.length === 0) {
        await conn.rollback();
        continue;
      }

      const job = jobRows[0];
      const status = String(job.status || '');
      if (!['queued', 'processing'].includes(status)) {
        await conn.commit();
        continue;
      }

      const [outputRows] = await conn.query('SELECT id FROM generation_outputs WHERE job_id = ? LIMIT 1', [jobId]);
      if (outputRows.length > 0) {
        await conn.query('UPDATE generation_jobs SET status = ?, error_message = NULL WHERE id = ?', ['completed', jobId]);
        await conn.commit();
        completed += 1;
        continue;
      }

      const [refundRows] = await conn.query(
        `SELECT id
         FROM points_ledger
         WHERE user_id = ? AND reason = 'GENERATION_REFUND' AND reference_id = ?
         LIMIT 1`,
        [userId, jobUuid],
      );

      if (refundRows.length === 0 && costPoints > 0) {
        const [userRows] = await conn.query('SELECT points FROM users WHERE id = ? FOR UPDATE', [userId]);
        if (userRows.length > 0) {
          const balanceAfter = Number(userRows[0].points || 0) + costPoints;
          await conn.query('UPDATE users SET points = ? WHERE id = ?', [balanceAfter, userId]);
          await conn.query(
            `INSERT INTO points_ledger
             (user_id, change_amount, balance_after, reason, reference_type, reference_id)
             VALUES (?, ?, ?, 'GENERATION_REFUND', 'generation_job', ?)`,
            [userId, costPoints, balanceAfter, jobUuid],
          );
          refunded += 1;
        }
      }

      await conn.query(
        'UPDATE generation_jobs SET status = ?, error_message = ? WHERE id = ?',
        ['failed', 'Service restarted, job cancelled', jobId],
      );
      await conn.commit();
      failed += 1;
    } catch (err) {
      await conn.rollback();
      console.error('[BOOT_RECOVERY_ERROR]', { jobUuid }, err);
    } finally {
      conn.release();
    }
  }

  return {
    scanned: rows.length,
    completed,
    failed,
    refunded,
  };
}

module.exports = {
  submitGeneration,
  listJobs,
  recoverInFlightJobsOnStartup,
};
