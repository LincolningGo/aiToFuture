const fs = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { pool } = require('../db/mysql');
const { AppError } = require('../utils/errors');
const { generateContent } = require('./provider/minimax-adapter');

const QUEUE_CONCURRENCY = Math.max(1, Number(process.env.GENERATION_QUEUE_CONCURRENCY || 2));
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
  const stripped = input.replace(/^data:.*;base64,/, '');
  return Buffer.from(stripped, 'base64');
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
  let inputImagePath = null;
  let inputImagePublicUrl = null;

  if (capability === 'image_to_image' && !inputImageBuffer) {
    throw new AppError('image_to_image requires source image', 400, 'SOURCE_IMAGE_REQUIRED');
  }

  if (inputImageBuffer) {
    const dateBucket = getDateBucket();
    const inputDir = path.join(config.storageRoot, dateBucket, 'inputs');
    await fs.mkdir(inputDir, { recursive: true });
    const inputName = `${uuidv4()}.png`;
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

  const [[totalRow]] = await pool.query('SELECT COUNT(*) AS total FROM generation_jobs WHERE user_id = ?', [userId]);
  const [[runningRow]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM generation_jobs
     WHERE user_id = ? AND status IN ('queued', 'processing')`,
    [userId],
  );

  const [rows] = await pool.query(
    `SELECT j.job_uuid, j.capability, j.provider, j.model_code, j.model_name,
            j.status, j.cost_points, j.prompt_text, j.error_message, j.created_at,
            o.file_type, o.local_path, o.public_url, o.metadata_json AS output_metadata
     FROM generation_jobs j
     LEFT JOIN generation_outputs o ON o.job_id = j.id
     WHERE j.user_id = ?
     ORDER BY j.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, safeLimit, offset],
  );

  const total = Number(totalRow?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / safeLimit));

  return {
    items: rows,
    pagination: {
      page: Math.min(safePage, totalPages),
      limit: safeLimit,
      total,
      totalPages,
    },
    hasRunningJobs: Number(runningRow?.total || 0) > 0,
  };
}

module.exports = {
  submitGeneration,
  listJobs,
};
