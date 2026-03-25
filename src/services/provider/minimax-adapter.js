const config = require('../../config');
const { AppError } = require('../../utils/errors');

const MOCK_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgQ6vVzEAAAAASUVORK5CYII=';
const HEX_REGEX = /^[0-9a-fA-F]+$/;

const LEGACY_MODEL_ALIASES = {
  'minimax-image-01': 'image-01',
  'minimax-image-edit-01': 'image-01',
  'minimax-video-01': 'T2V-01-Director',
  'minimax-voice-01': 'speech-02-hd',
  'image-01-i2i': 'image-01',
  'image-01-live-i2i': 'image-01-live',
};

function buildMockOutput(capability, prompt) {
  if (capability === 'text_to_image' || capability === 'image_to_image') {
    return {
      buffer: Buffer.from(MOCK_PNG_BASE64, 'base64'),
      fileType: 'image',
      extension: 'png',
      mimeType: 'image/png',
      metadata: { mock: true, capability, promptLength: prompt.length },
    };
  }

  if (capability === 'text_to_video') {
    return {
      buffer: Buffer.from(`MOCK_VIDEO:${prompt}`),
      fileType: 'video',
      extension: 'mp4',
      mimeType: 'video/mp4',
      metadata: { mock: true, capability, note: 'placeholder video bytes' },
    };
  }

  return {
    buffer: Buffer.from(`MOCK_AUDIO:${prompt}`),
    fileType: 'audio',
    extension: 'mp3',
    mimeType: 'audio/mpeg',
    metadata: { mock: true, capability, note: 'placeholder audio bytes' },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function getDefaultModel(capability) {
  if (capability === 'text_to_video') return config.minimaxVideoModel;
  if (capability === 'text_to_audio') return config.minimaxT2aModel;
  return config.minimaxImageModel;
}

function resolveModelCode(capability, modelCode) {
  const raw = String(modelCode || '').trim();
  const normalized = LEGACY_MODEL_ALIASES[raw] || raw;
  if (normalized) return normalized;
  return getDefaultModel(capability);
}

function buildMinimaxHeaders() {
  return {
    Authorization: `Bearer ${config.minimaxApiKey}`,
    'Content-Type': 'application/json',
  };
}

function parseJsonSafe(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getFirstDefined(...values) {
  for (const item of values) {
    if (item !== undefined && item !== null && item !== '') {
      return item;
    }
  }
  return null;
}

function extractApiMessage(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const baseResp = payload.base_resp || payload.baseResp || {};
  return getFirstDefined(
    baseResp.status_msg,
    baseResp.statusMsg,
    payload.message,
    payload.msg,
    payload.error_msg,
    payload.error,
  );
}

function throwMiniMaxError(payload, fallbackStatus = 502) {
  const message = extractApiMessage(payload) || 'MiniMax API request failed';
  throw new AppError(message, fallbackStatus, 'MINIMAX_API_ERROR');
}

async function minimaxRequestJson({ method, pathname, body, query }) {
  const base = trimTrailingSlash(config.minimaxApiBase || 'https://api.minimaxi.com');
  const url = new URL(`${base}${pathname}`);
  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: buildMinimaxHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new AppError(`MiniMax request failed: ${err.message}`, 502, 'MINIMAX_NETWORK_ERROR');
  }

  const text = await response.text();
  const payload = parseJsonSafe(text);

  if (!response.ok) {
    const message =
      extractApiMessage(payload) ||
      `MiniMax HTTP error ${response.status}: ${text.slice(0, 200) || response.statusText}`;
    throw new AppError(message, 502, 'MINIMAX_HTTP_ERROR');
  }

  if (payload && typeof payload === 'object') {
    const baseResp = payload.base_resp || payload.baseResp;
    if (baseResp && Number(baseResp.status_code ?? baseResp.statusCode ?? 0) !== 0) {
      throwMiniMaxError(payload, 502);
    }
  }

  if (payload === null) {
    throw new AppError('MiniMax returned invalid JSON response', 502, 'MINIMAX_INVALID_RESPONSE');
  }

  return payload;
}

function guessExtensionByMime(mimeType, fallbackExt) {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('flac')) return 'flac';
  if (mime.includes('aac')) return 'aac';
  return fallbackExt;
}

function toDataUrl(inputImageBuffer) {
  if (!inputImageBuffer) return null;
  return `data:image/png;base64,${inputImageBuffer.toString('base64')}`;
}

function isLikelyPrivateUrl(urlValue) {
  const raw = String(urlValue || '');
  if (!raw) return false;
  return /:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(raw);
}

async function downloadBinary(url, fallbackMimeType = 'application/octet-stream') {
  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new AppError(`Failed to download MiniMax output: ${err.message}`, 502, 'MINIMAX_DOWNLOAD_FAILED');
  }

  if (!response.ok) {
    throw new AppError(`Failed to download MiniMax output: HTTP ${response.status}`, 502, 'MINIMAX_DOWNLOAD_FAILED');
  }

  const mimeType = response.headers.get('content-type') || fallbackMimeType;
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, mimeType };
}

async function generateImage(payload) {
  const model = resolveModelCode(payload.capability, payload.modelCode);
  const requestBody = {
    model,
    prompt: payload.prompt,
    response_format: 'url',
  };

  if (payload.capability === 'image_to_image') {
    const publicUrl = String(payload.inputImagePublicUrl || '');
    const dataUrl = toDataUrl(payload.inputImageBuffer);
    const sourceImage = isLikelyPrivateUrl(publicUrl) ? dataUrl || publicUrl : publicUrl || dataUrl;
    if (!sourceImage) {
      throw new AppError('MiniMax image_to_image requires input image', 400, 'SOURCE_IMAGE_REQUIRED');
    }
    requestBody.subject_reference = [{ type: 'character', image_file: sourceImage }];
  }

  const resp = await minimaxRequestJson({
    method: 'POST',
    pathname: '/v1/image_generation',
    body: requestBody,
  });

  const imageUrl = getFirstDefined(
    typeof resp?.data?.image_urls?.[0] === 'string' ? resp.data.image_urls[0] : null,
    resp?.data?.image_urls?.[0]?.url,
    typeof resp?.image_urls?.[0] === 'string' ? resp.image_urls[0] : null,
    resp?.image_urls?.[0]?.url,
    resp?.data?.image_url,
    resp?.image_url,
  );
  if (!imageUrl) {
    throw new AppError('MiniMax image response missing output URL', 502, 'MINIMAX_INVALID_RESPONSE');
  }

  const { buffer, mimeType } = await downloadBinary(imageUrl, 'image/png');
  const extension = guessExtensionByMime(mimeType, 'png');

  return {
    buffer,
    fileType: 'image',
    extension,
    mimeType,
    metadata: {
      provider: 'minimax',
      capability: payload.capability,
      model,
      imageUrl,
    },
  };
}

async function queryVideoResult(taskId) {
  const maxAttempts = Math.max(1, Number(config.minimaxVideoPollMaxAttempts || 36));
  const intervalMs = Math.max(1000, Number(config.minimaxVideoPollIntervalMs || 5000));
  let lastStatus = 'unknown';

  for (let i = 0; i < maxAttempts; i += 1) {
    if (i > 0) await sleep(intervalMs);

    const resp = await minimaxRequestJson({
      method: 'GET',
      pathname: '/v1/query/video_generation',
      query: { task_id: taskId },
    });

    const status = String(getFirstDefined(resp?.status, resp?.data?.status, '')).toLowerCase();
    const fileId = getFirstDefined(resp?.file_id, resp?.data?.file_id);
    const failureReason = getFirstDefined(resp?.base_resp?.status_msg, resp?.data?.error, resp?.message);
    lastStatus = status || lastStatus;

    if (fileId) {
      return { fileId, status: status || 'success' };
    }
    if (status.includes('fail') || status.includes('error') || status.includes('cancel')) {
      throw new AppError(
        `MiniMax video generation failed: ${failureReason || status}`,
        502,
        'MINIMAX_VIDEO_FAILED',
      );
    }
  }

  throw new AppError(
    `MiniMax video generation timeout, last status: ${lastStatus}`,
    504,
    'MINIMAX_VIDEO_TIMEOUT',
  );
}

async function generateVideo(payload) {
  const model = resolveModelCode(payload.capability, payload.modelCode);
  const createResp = await minimaxRequestJson({
    method: 'POST',
    pathname: '/v1/video_generation',
    body: {
      model,
      prompt: payload.prompt,
    },
  });

  const taskId = getFirstDefined(createResp?.task_id, createResp?.data?.task_id);
  if (!taskId) {
    throw new AppError('MiniMax video response missing task_id', 502, 'MINIMAX_INVALID_RESPONSE');
  }

  const { fileId, status } = await queryVideoResult(taskId);

  const fileResp = await minimaxRequestJson({
    method: 'GET',
    pathname: '/v1/files/retrieve',
    query: { file_id: fileId },
  });

  const downloadUrl = getFirstDefined(
    fileResp?.file?.download_url,
    fileResp?.data?.file?.download_url,
    fileResp?.data?.download_url,
    fileResp?.download_url,
  );
  if (!downloadUrl) {
    throw new AppError('MiniMax file response missing download_url', 502, 'MINIMAX_INVALID_RESPONSE');
  }

  const { buffer, mimeType } = await downloadBinary(downloadUrl, 'video/mp4');
  const extension = guessExtensionByMime(mimeType, 'mp4');

  return {
    buffer,
    fileType: 'video',
    extension,
    mimeType,
    metadata: {
      provider: 'minimax',
      capability: payload.capability,
      model,
      taskId,
      fileId,
      status,
    },
  };
}

function parseAudioBuffer(audioString) {
  if (typeof audioString !== 'string' || !audioString.trim()) {
    throw new AppError('MiniMax audio response missing audio payload', 502, 'MINIMAX_INVALID_RESPONSE');
  }
  const normalized = audioString.trim();
  if (HEX_REGEX.test(normalized) && normalized.length % 2 === 0) {
    return Buffer.from(normalized, 'hex');
  }
  return Buffer.from(normalized, 'base64');
}

function audioFormatToMime(format) {
  const normalized = String(format || '').toLowerCase();
  if (normalized === 'wav') return 'audio/wav';
  if (normalized === 'flac') return 'audio/flac';
  if (normalized === 'aac') return 'audio/aac';
  return 'audio/mpeg';
}

async function generateLyrics(payload) {
  const resp = await minimaxRequestJson({
    method: 'POST',
    pathname: '/v1/lyrics_generation',
    body: {
      mode: 'write_full_song',
      prompt: payload.prompt,
    },
  });

  const songTitle = String(getFirstDefined(resp?.data?.song_title, resp?.song_title, 'Generated Lyrics'));
  const styleTags = String(getFirstDefined(resp?.data?.style_tags, resp?.style_tags, '') || '');
  const lyrics = String(getFirstDefined(resp?.data?.lyrics, resp?.lyrics, '') || '').trim();

  if (!lyrics) {
    throw new AppError('MiniMax lyrics response missing lyrics', 502, 'MINIMAX_INVALID_RESPONSE');
  }

  const text = [songTitle, styleTags, lyrics].filter(Boolean).join('\n\n');
  return {
    buffer: Buffer.from(text, 'utf8'),
    fileType: 'text',
    extension: 'txt',
    mimeType: 'text/plain; charset=utf-8',
    metadata: {
      provider: 'minimax',
      capability: payload.capability,
      model: payload.modelCode || 'lyrics_generation',
      songTitle,
      styleTags,
      textPreview: lyrics.split('\n').slice(0, 6).join('\n'),
    },
  };
}

async function generateAudio(payload) {
  const requestedModel = resolveModelCode(payload.capability, payload.modelCode);
  const model = requestedModel.startsWith('speech-') ? requestedModel : config.minimaxT2aModel;
  const format = 'mp3';

  const resp = await minimaxRequestJson({
    method: 'POST',
    pathname: '/v1/t2a_v2',
    body: {
      model,
      text: payload.prompt,
      stream: false,
      voice_setting: {
        voice_id: config.minimaxT2aVoiceId,
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format,
        channel: 1,
      },
    },
  });

  const audioUrl = getFirstDefined(resp?.data?.audio_url, resp?.audio_url);
  if (audioUrl) {
    const { buffer, mimeType } = await downloadBinary(audioUrl, 'audio/mpeg');
    return {
      buffer,
      fileType: 'audio',
      extension: guessExtensionByMime(mimeType, format),
      mimeType,
      metadata: {
        provider: 'minimax',
        capability: payload.capability,
        model,
        voiceId: config.minimaxT2aVoiceId,
        audioUrl,
      },
    };
  }

  const audioString = getFirstDefined(resp?.data?.audio, resp?.audio);
  const audioBuffer = parseAudioBuffer(audioString);

  return {
    buffer: audioBuffer,
    fileType: 'audio',
    extension: format,
    mimeType: audioFormatToMime(format),
    metadata: {
      provider: 'minimax',
      capability: payload.capability,
      model,
      voiceId: config.minimaxT2aVoiceId,
    },
  };
}

async function generateMusic(payload) {
  const model = resolveModelCode(payload.capability, payload.modelCode);
  const format = 'mp3';
  const normalizedLyrics = String(payload.lyrics || '').trim();
  const isInstrumental = Boolean(payload.isInstrumental);

  const resp = await minimaxRequestJson({
    method: 'POST',
    pathname: '/v1/music_generation',
    body: {
      model,
      prompt: payload.prompt,
      lyrics: normalizedLyrics || undefined,
      lyrics_optimizer: !isInstrumental && normalizedLyrics.length === 0,
      is_instrumental: isInstrumental,
      output_format: 'hex',
      audio_setting: {
        sample_rate: 44100,
        bitrate: 256000,
        format,
      },
    },
  });

  const audioString = getFirstDefined(resp?.data?.audio, resp?.audio);
  const audioBuffer = parseAudioBuffer(audioString);

  return {
    buffer: audioBuffer,
    fileType: 'audio',
    extension: format,
    mimeType: audioFormatToMime(format),
    metadata: {
      provider: 'minimax',
      capability: payload.capability,
      model,
      isInstrumental,
      lyricsIncluded: normalizedLyrics.length > 0,
    },
  };
}

async function generateWithMinimax(payload) {
  if (!config.minimaxApiKey) {
    throw new AppError('MINIMAX_API_KEY is required when AI_PROVIDER=minimax', 500, 'MINIMAX_KEY_MISSING');
  }

  if (payload.capability === 'text_to_image' || payload.capability === 'image_to_image') {
    return generateImage(payload);
  }
  if (payload.capability === 'text_to_video') {
    return generateVideo(payload);
  }
  if (payload.capability === 'text_to_audio') {
    return generateAudio(payload);
  }
  if (payload.capability === 'lyrics_generation') {
    return generateLyrics(payload);
  }
  if (payload.capability === 'music_generation') {
    return generateMusic(payload);
  }

  throw new AppError(`Unsupported capability: ${payload.capability}`, 400, 'UNSUPPORTED_CAPABILITY');
}

async function generateContent(payload) {
  if (config.aiProvider === 'minimax') {
    return generateWithMinimax(payload);
  }

  return buildMockOutput(payload.capability, payload.prompt);
}

module.exports = {
  generateContent,
};
