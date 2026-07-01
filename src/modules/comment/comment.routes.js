import { Router } from 'express';
import { sequelize, Comment, ActivityLog, Feedback, User, Website, Project } from '../../database/models/index.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success } from '../../common/utils/response.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { addCommentSchema } from '../auth/auth.validation.js';
import { NotFoundError } from '../../common/errors/AppError.js';
import { requireFeedbackAccess } from '../../common/middleware/authorizeWorkspace.js';
import { notificationService } from '../../common/services/notification.service.js';
import { emailService } from '../../common/services/email.service.js';

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
  const feedback = await Feedback.findByPk(req.params.feedbackId, {
    include: [{
      model: Website,
      attributes: ['id', 'projectId'],
      include: [{ model: Project, attributes: ['id', 'workspaceId'] }],
    }],
  });
  if (!feedback) throw new NotFoundError('Feedback not found');

  const comment = await sequelize.transaction(async (tx) => {
    const c = await Comment.create({
      feedbackId: req.params.feedbackId,
      userId: req.user.id,
      body: req.body.body,
    }, { transaction: tx });

    const activity = await ActivityLog.create({
      feedbackId: req.params.feedbackId,
      actorId: req.user.id,
      action: 'comment_added',
      metadata: { commentId: c.id, preview: req.body.body.slice(0, 100) },
    }, { transaction: tx });

    return { comment: c, activity };
  });

  const io = req.app.get('io');
  if (comment.activity) {
    notificationService.emitActivity(io, req.params.feedbackId, comment.activity);
  }

  const website = feedback.Website;
  const projectId = website?.Project?.id;
  await notificationService.notifyCommentAdded({
    feedback,
    comment: comment.comment,
    actorId: req.user.id,
    projectId,
  });

  const feedbackAuthor = await User.findByPk(feedback.reporterId, { attributes: ['email', 'name'] });
  if (feedbackAuthor?.email && feedbackAuthor.email !== req.user.email) {
    await emailService.sendCommentEmail({
      toEmail: feedbackAuthor.email,
      toName: feedbackAuthor.name,
      feedbackTitle: feedback.title || feedback.comment,
      feedbackId: feedback.id,
      projectId,
      commentPreview: req.body.body.slice(0, 200),
      commenterName: req.user.name,
    });
  }

  res.status(201).json(success(comment.comment));
}));

export { router as commentRoutes };
