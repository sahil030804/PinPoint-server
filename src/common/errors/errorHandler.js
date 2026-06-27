import { AppError } from './AppError.js';
import { ERROR_CODES } from './errorCodes.js';
import pino from 'pino';

const logger = pino({ name: 'error-handler' });

export function errorHandler(err, req, res, _next) {
  // Log all errors
  logger.error({
    err,
    method: req.method,
    url: req.url,
    ip: req.ip,
  }, err.message);

  // Handle known operational errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Invalid request data',
        details: err.errors,
      },
    });
  }

  // Handle Sequelize validation errors
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Database validation error',
        details: err.errors?.map((e) => ({ field: e.path, message: e.message })),
      },
    });
  }

  // Generic server error
  return res.status(500).json({
    success: false,
    error: {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    },
  });
}
