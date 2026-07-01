import { Notification, WorkspaceMember, User } from '../../database/models/index.js';
import { logger } from '../middleware/requestLogger.js';

export class NotificationService {
  async create({ userId, type, title, body, link }) {
    return Notification.create({ userId, type, title, body, link });
  }

  async notifyFeedbackCreated({ feedback, workspaceId, projectId, actorId }) {
    const workspaceMembers = await WorkspaceMember.findAll({
      where: { workspaceId },
      include: [{ model: User, attributes: ['id', 'email', 'name'] }],
    });

    for (const member of workspaceMembers) {
      if (member.userId === actorId) continue;
      await this.create({
        userId: member.userId,
        type: 'feedback.created',
        title: `New feedback: ${feedback.title || 'Untitled'}`,
        body: feedback.comment?.slice(0, 200),
        link: projectId ? `/dashboard/projects/${projectId}/feedback/${feedback.id}` : null,
      });
    }
  }

  async notifyFeedbackAssigned({ feedback, assigneeId, actorId, projectId }) {
    if (!assigneeId || assigneeId === actorId) return;
    await this.create({
      userId: assigneeId,
      type: 'feedback.assigned',
      title: 'You have been assigned feedback',
      body: feedback.title || feedback.comment?.slice(0, 200),
      link: projectId ? `/dashboard/projects/${projectId}/feedback/${feedback.id}` : null,
    });
  }

  async notifyFeedbackStatusChanged({ feedback, actorId, projectId }) {
    if (!feedback.assigneeId || feedback.assigneeId === actorId) return;
    await this.create({
      userId: feedback.assigneeId,
      type: 'feedback.status_changed',
      title: `Feedback status changed to ${feedback.status}`,
      body: feedback.title || feedback.comment?.slice(0, 200),
      link: projectId ? `/dashboard/projects/${projectId}/feedback/${feedback.id}` : null,
    });
  }

  async notifyCommentAdded({ feedback, comment, actorId, projectId }) {
    const notifyUserIds = [];
    if (feedback.assigneeId && feedback.assigneeId !== actorId) {
      notifyUserIds.push(feedback.assigneeId);
    }

    for (const userId of notifyUserIds) {
      await this.create({
        userId,
        type: 'comment.added',
        title: 'New comment on feedback',
        body: comment.body?.slice(0, 200),
        link: projectId ? `/dashboard/projects/${projectId}/feedback/${feedback.id}` : null,
      });
    }
  }

  emitActivity(io, feedbackId, activity) {
    if (!io) {
      logger.warn('[Socket.io] io not available, skipping emit');
      return;
    }
    io.to(`feedback:${feedbackId}`).emit('activity:new', activity);
  }
}

export const notificationService = new NotificationService();
