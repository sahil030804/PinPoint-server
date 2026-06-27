import { Router } from 'express';
import { sequelize, Comment, ActivityLog, Feedback, User } from '../../database/models/index.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success } from '../../common/utils/response.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { addCommentSchema } from '../auth/auth.validation.js';
import { NotFoundError } from '../../common/errors/AppError.js';
import { requireFeedbackAccess } from '../../common/middleware/authorizeWorkspace.js';

const router = Router();
router.use(authenticate);

// List comments for a feedback
router.get('/feedback/:feedbackId', requireFeedbackAccess, asyncHandler(async (req, res) => {
  const comments = await Comment.findAll({
    where: { feedbackId: req.params.feedbackId },
    include: [
      { model: User, as: 'author', attributes: ['id', 'name', 'email', 'avatarUrl'] },
    ],
    order: [['createdAt', 'ASC']],
  });
  res.json(success(comments));
}));

// Add comment
router.post('/feedback/:feedbackId', requireFeedbackAccess, validate(addCommentSchema), asyncHandler(async (req, res) => {
  const feedback = await Feedback.findByPk(req.params.feedbackId);
  if (!feedback) throw new NotFoundError('Feedback not found');

  const comment = await sequelize.transaction(async (tx) => {
    const c = await Comment.create({
      feedbackId: req.params.feedbackId,
      userId: req.user.id,
      body: req.body.body,
    }, { transaction: tx });

    await ActivityLog.create({
      feedbackId: req.params.feedbackId,
      actorId: req.user.id,
      action: 'comment_added',
      metadata: { commentId: c.id, preview: req.body.body.slice(0, 100) },
    }, { transaction: tx });

    return c;
  });

  res.status(201).json(success(comment));
}));

export { router as commentRoutes };
