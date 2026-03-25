const fs = require('fs/promises');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { pool } = require('../db/mysql');
const { AppError } = require('../utils/errors');
const { generateContent } = require('./provider/minimax-adapter');

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

async function deductPointsAndCreateJob({ userId, capability, prompt, costPoints, inputImagePath }) {
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
       (job_uuid, user_id, capability, provider, prompt_text, input_image_path, status, cost_points)
       VALUES (?, ?, ?, ?, ?, ?, 'processing', ?)`,
      [jobUuid, userId, capability, config.aiProvider, prompt, inputImagePath || null, costPoints],
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

async function markFailed(jobUuid, message) {
  await pool.query('UPDATE generation_jobs SET status = ?, error_message = ? WHERE job_uuid = ?', [
    'failed',
    message,
    jobUuid,
  ]);
}

async function persistOutput({ userId, jobId, jobUuid, output }) {
  const userDir = path.join(config.storageRoot, String(userId));
  await fs.mkdir(userDir, { recursive: true });

  const filename = `${jobUuid}.${output.extension}`;
  const absolutePath = path.join(userDir, filename);
  await fs.writeFile(absolutePath, output.buffer);

  const publicUrl = `/generated/${userId}/${filename}`;

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

async function submitGeneration({ userId, capability, prompt, inputImageBase64 }) {
  const inputImageBuffer = normalizeBase64(inputImageBase64);
  let inputImagePath = null;

  if (capability === 'image_to_image' && !inputImageBuffer) {
    throw new AppError('image_to_image requires source image', 400, 'SOURCE_IMAGE_REQUIRED');
  }

  if (inputImageBuffer) {
    const inputDir = path.join(config.storageRoot, String(userId), 'inputs');
    await fs.mkdir(inputDir, { recursive: true });
    const inputName = `${uuidv4()}.png`;
    inputImagePath = path.join(inputDir, inputName);
    await fs.writeFile(inputImagePath, inputImageBuffer);
  }

  const costPoints = await getCostPoints(capability);
  const { jobId, jobUuid } = await deductPointsAndCreateJob({
    userId,
    capability,
    prompt,
    costPoints,
    inputImagePath,
  });

  try {
    const output = await generateContent({
      capability,
      prompt,
      inputImageBuffer,
    });

    const persisted = await persistOutput({
      userId,
      jobId,
      jobUuid,
      output,
    });

    return {
      jobUuid,
      capability,
      status: 'completed',
      costPoints,
      output: persisted,
    };
  } catch (err) {
    await markFailed(jobUuid, err.message || 'Generation failed');
    await refundPoints({ userId, jobUuid, costPoints });
    throw err;
  }
}

async function listJobs(userId, limit = 20) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const [rows] = await pool.query(
    `SELECT j.job_uuid, j.capability, j.status, j.cost_points, j.prompt_text,
            j.error_message, j.created_at,
            o.file_type, o.local_path, o.public_url
     FROM generation_jobs j
     LEFT JOIN generation_outputs o ON o.job_id = j.id
     WHERE j.user_id = ?
     ORDER BY j.created_at DESC
     LIMIT ?`,
    [userId, safeLimit],
  );
  return rows;
}

module.exports = {
  submitGeneration,
  listJobs,
};
