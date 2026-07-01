import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success } from '../../common/utils/response.js';
import { authService } from './auth.service.js';
import { emailService } from '../../common/services/email.service.js';
import { createRateLimiter } from '../../common/middleware/rateLimiter.js';

const forgotPasswordLimiter = createRateLimiter({
  windowMs: 3600000,
  max: 3,
  message: 'Too many password reset requests, please try again later',
});

export const authController = {
  register: asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    res.status(201).json(success(result));
  }),

  login: asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    res.json(success(result));
  }),

  me: asyncHandler(async (req, res) => {
    const { User, WorkspaceMember } = await import('../../database/models/index.js');
    const user = await User.findByPk(req.user.id);
    const membership = await WorkspaceMember.findOne({ where: { userId: user.id } });
    const workspaceId = req.query.workspaceId || membership?.workspaceId || null;
    let role = membership?.role || null;
    if (workspaceId && workspaceId !== membership?.workspaceId) {
      const targetMembership = await WorkspaceMember.findOne({
        where: { userId: user.id, workspaceId },
      });
      role = targetMembership?.role || null;
    }
    res.json(success(authService.sanitizeUser(user, workspaceId, role)));
  }),

  refresh: asyncHandler(async (req, res) => {
    const result = await authService.refresh(req.user.id);
    res.json(success(result));
  }),

  updateProfile: asyncHandler(async (req, res) => {
    const result = await authService.updateProfile(req.user.id, req.body);
    res.json(success(result));
  }),

  logout: asyncHandler(async (req, res) => {
    await authService.invalidateSessions(req.user.id);
    res.json(success({ message: 'Logged out successfully' }));
  }),

  forgotPassword: [
    forgotPasswordLimiter,
    asyncHandler(async (req, res) => {
      const result = await authService.forgotPassword(req.body);
      if (result.resetToken) {
        await emailService.sendPasswordResetEmail({
          toEmail: result.email,
          resetToken: result.resetToken,
        });
      }
      res.json(success({ message: 'If the email exists, a reset link has been sent.' }));
    }),
  ],

  resetPassword: asyncHandler(async (req, res) => {
    const result = await authService.resetPassword({
      token: req.params.token,
      password: req.body.password,
    });
    res.json(success(result));
  }),
};
