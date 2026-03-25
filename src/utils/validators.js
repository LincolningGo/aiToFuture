const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,32}$/;

function validateRegisterInput({ username, email, password }) {
  if (!username || !USERNAME_REGEX.test(username)) {
    return 'Username must be 3-32 chars and only include letters/numbers/_';
  }
  if (!email || !EMAIL_REGEX.test(email)) {
    return 'Invalid email format';
  }
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  return null;
}

function validateGenerationInput({ capability, prompt, inputImageBase64, modelCode, lyrics, isInstrumental }) {
  const supported = new Set([
    'text_to_image',
    'image_to_image',
    'text_to_video',
    'text_to_audio',
    'lyrics_generation',
    'music_generation',
  ]);
  const promptMaxLengthByCapability = {
    text_to_image: 1500,
    image_to_image: 1500,
    text_to_video: 1500,
    text_to_audio: 1500,
    lyrics_generation: 2000,
    music_generation: 2000,
  };
  if (!supported.has(capability)) {
    return 'Unsupported capability';
  }
  if (!prompt || prompt.trim().length < 2) {
    return 'Prompt is required';
  }
  const promptMaxLength = promptMaxLengthByCapability[capability] || 1500;
  if (prompt.trim().length > promptMaxLength) {
    return `Prompt length must be 2-${promptMaxLength}`;
  }
  if (capability === 'image_to_image' && !inputImageBase64) {
    return 'image_to_image requires inputImageBase64';
  }
  if (capability === 'music_generation') {
    if (lyrics !== undefined && typeof lyrics !== 'string') {
      return 'lyrics must be a string';
    }
    if (lyrics && lyrics.trim().length > 3500) {
      return 'lyrics length must be 1-3500';
    }
    if (isInstrumental !== undefined && typeof isInstrumental !== 'boolean') {
      return 'isInstrumental must be a boolean';
    }
  }
  if (modelCode !== undefined) {
    if (typeof modelCode !== 'string') {
      return 'modelCode must be a string';
    }
    const normalized = modelCode.trim();
    if (!normalized || normalized.length > 80) {
      return 'modelCode length must be 1-80';
    }
  }
  return null;
}

module.exports = {
  validateRegisterInput,
  validateGenerationInput,
};
