const config = require('../../config');
const { AppError } = require('../../utils/errors');

const MOCK_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAoMBgQ6vVzEAAAAASUVORK5CYII=';

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

async function generateWithMinimax(_payload) {
  if (!config.minimaxApiKey) {
    throw new AppError('MINIMAX_API_KEY is required when AI_PROVIDER=minimax', 500, 'MINIMAX_KEY_MISSING');
  }
  throw new AppError('MiniMax adapter is scaffolded but not implemented yet', 501, 'MINIMAX_NOT_IMPLEMENTED');
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
