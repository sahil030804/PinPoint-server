import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validate } from '../../common/middleware/validate.js';
import { authenticate, authenticateRefresh } from '../../common/middleware/authenticate.js';
import { createRateLimiter } from '../../common/middleware/rateLimiter.js';
import { registerSchema, loginSchema, updateProfileSchema } from './auth.validation.js';

const router = Router();

const authRateLimiter = createRateLimiter({
  windowMs: 60000,
  max: 10,
  message: 'Too many auth attempts, please try again later',
});

router.post('/register', authRateLimiter, validate(registerSchema), authController.register);
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);
router.put('/me', authenticate, validate(updateProfileSchema), authController.updateProfile);
router.post('/refresh', authenticateRefresh, authController.refresh);

export { router as authRoutes };
