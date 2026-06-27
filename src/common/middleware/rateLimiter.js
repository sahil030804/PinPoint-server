import rateLimit from 'express-rate-limit';
import { RateLimitError } from '../errors/AppError.js';

export function createRateLimiter(options = {}) {
  const {
    windowMs = 60000,
    max = 100,
    message = 'Too many requests, please try again later',
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_ERROR',
        message,
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res) => {
      throw new RateLimitError(message);
    },
  });
}
