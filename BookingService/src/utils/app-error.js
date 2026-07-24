/**
 * A typed application error that carries the HTTP status code the client
 * should receive. Lets the service layer signal intent (404, 409, 400, 502…)
 * without knowing about Express, and lets the controller map it cleanly
 * instead of returning 400/500 for everything (JOURNAL 0.4).
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

module.exports = AppError;
