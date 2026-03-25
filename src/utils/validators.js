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

function validateGenerationInput({ capability, prompt, inputImageBase64, modelCode }) {
  const supported = new Set(['text_to_image', 'image_to_image', 'text_to_video', 'text_to_audio']);
  if (!supported.has(capability)) {
    return 'Unsupported capability';
  }
  if (!prompt || prompt.trim().length < 2) {
    return 'Prompt is required';
  }
  if (capability === 'image_to_image' && !inputImageBase64) {
    return 'image_to_image requires inputImageBase64';
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
