import { Router } from 'express';
import { ActivityLog, User, Feedback } from '../../database/models/index.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success } from '../../common/utils/response.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { NotFoundError } from '../../common/errors/AppError.js';
import { requireFeedbackAccess } from '../../common/middleware/authorizeWorkspace.js';

const router = Router();
router.use(authenticate);

// Get timeline for a feedback item
router.get('/feedback/:feedbackId', requireFeedbackAccess, asyncHandler(async (req, res) => {
  const activities = await ActivityLog.findAll({
    where: { feedbackId: req.params.feedbackId },
    include: [
      { model: User, as: 'actor', attributes: ['id', 'name', 'email', 'avatarUrl'] },
    ],
    order: [['createdAt', 'DESC']],
  });

  if (!activities.length) {
    const feedback = await Feedback.findByPk(req.params.feedbackId);
    if (!feedback) throw new NotFoundError('Feedback not found');
  }

  res.json(success(activities));
}));

export { router as timelineRoutes };
