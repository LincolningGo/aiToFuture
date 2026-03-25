class AppError extends Error {
  constructor(message, status = 400, code = 'APP_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

module.exports = {
  AppError,
};
