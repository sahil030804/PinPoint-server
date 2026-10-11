import { Router } from 'express';
import { sequelize, Comment, ActivityLog, Feedback, User, Website, Project, WorkspaceMember } from '../../database/models/index.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success } from '../../common/utils/response.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { addCommentSchema, updateCommentSchema } from '../auth/auth.validation.js';
import { NotFoundError, AuthorizationError } from '../../common/errors/AppError.js';
import { requireFeedbackAccess } from '../../common/middleware/authorizeWorkspace.js';
import { notificationService } from '../../common/services/notification.service.js';
import { emailService } from '../../common/services/email.service.js';
import { webhookService } from '../../common/services/webhook.service.js';

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

  const workspaceId = website?.Project?.workspaceId;
  if (workspaceId) {
    webhookService.sendWebhook('comment.created', {
      workspaceId,
      feedbackId: feedback.id,
      title: feedback.title || feedback.comment?.slice(0, 80),
      commentPreview: req.body.body?.slice(0, 200),
      pageUrl: feedback.pageUrl,
      status: feedback.status,
      priority: feedback.priority,
      reporterName: feedback.reporterName,
    });
  }

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

// Load a comment with its workspace context (for edit/delete authorization)
async function loadCommentWithWorkspace(commentId, userId, req) {
  const comment = await Comment.findByPk(commentId, {
    include: [{
      model: Feedback,
      attributes: ['id', 'websiteId'],
      include: [{
        model: Website,
        attributes: ['id', 'projectId'],
        include: [{ model: Project, attributes: ['id', 'workspaceId'] }],
      }],
    }],
  });
  if (!comment) throw new NotFoundError('Comment not found');
  const workspaceId = comment.Feedback?.Website?.Project?.workspaceId;
  if (!workspaceId) throw new NotFoundError('Comment not found');
  const membership = await WorkspaceMember.findOne({ where: { userId, workspaceId } });
  if (!membership) throw new AuthorizationError('Not a member of this workspace');
  req.membership = membership;
  return comment;
}

// Edit a comment (author only)
router.put('/:commentId', authenticate, validate(updateCommentSchema), asyncHandler(async (req, res) => {
  const comment = await loadCommentWithWorkspace(req.params.commentId, req.user.id, req);
  if (comment.userId !== req.user.id) {
    throw new AuthorizationError('Only the author can edit this comment');
  }
  await comment.update({ body: req.body.body });
  res.json(success(comment));
}));

// Delete a comment (author, or owner/admin of the workspace)
router.delete('/:commentId', authenticate, asyncHandler(async (req, res) => {
  const comment = await loadCommentWithWorkspace(req.params.commentId, req.user.id, req);
  const privileged = ['owner', 'admin'].includes(req.membership.role);
  if (comment.userId !== req.user.id && !privileged) {
    throw new AuthorizationError('Only the author or a workspace admin can delete this comment');
  }
  await comment.destroy();
  res.json(success({ deleted: true }));
}));

export { router as commentRoutes };
