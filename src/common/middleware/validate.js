import { ZodError } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { error } from '../utils/response.js';

export const validate = (schema) =>
  asyncHandler(async (req, _res, next) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return _res.status(400).json(
          error('VALIDATION_ERROR', 'Invalid request data', err.errors)
        );
      }
      next(err);
    }
  });
