import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from '../../../common/services/notification.service.js';
import { Notification, WorkspaceMember, User } from '../../../database/models/index.js';
import { logger } from '../../../common/middleware/requestLogger.js';

describe('NotificationService', () => {
  let service;

  beforeEach(() => {
    service = new NotificationService();
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('creates a notification with correct fields', async () => {
      const result = await service.create({
        userId: 'user-1',
        type: 'test.type',
        title: 'Test notification',
        body: 'Test body',
        link: '/test',
      });

      expect(Notification.create).toHaveBeenCalledWith({
        userId: 'user-1',
        type: 'test.type',
        title: 'Test notification',
        body: 'Test body',
        link: '/test',
      });
      expect(result).toBeDefined();
    });
  });

  describe('notifyFeedbackCreated', () => {
    const feedback = {
      id: 'fb-1',
      title: 'Bug on homepage',
      comment: 'The button is misaligned',
    };
    const workspaceId = 'ws-1';
    const projectId = 'proj-1';

    it('notifies all workspace members except the actor', async () => {
      await service.notifyFeedbackCreated({ feedback, workspaceId, projectId, actorId: 'user-2' });

      expect(WorkspaceMember.findAll).toHaveBeenCalledWith({
        where: { workspaceId },
        include: [{ model: User, attributes: ['id', 'email', 'name'] }],
      });

      // user-2 is the actor, should be skipped; user-3 should get notification
      expect(Notification.create).toHaveBeenCalledTimes(1);
      expect(Notification.create).toHaveBeenCalledWith({
        userId: 'user-3',
        type: 'feedback.created',
        title: 'New feedback: Bug on homepage',
        body: 'The button is misaligned',
        link: '/dashboard/projects/proj-1/feedback/fb-1',
      });
    });

    it('uses Untitled when feedback has no title', async () => {
      const noTitle = { id: 'fb-2', comment: 'Some feedback' };
      await service.notifyFeedbackCreated({ feedback: noTitle, workspaceId, projectId, actorId: null });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New feedback: Untitled' })
      );
    });

    it('creates link only when projectId is provided', async () => {
      const result = await service.notifyFeedbackCreated({
        feedback, workspaceId, projectId: null, actorId: null,
      });

      expect(Notification.create).toHaveBeenCalledWith(
        expect.objectContaining({ link: null })
      );
    });

    it('notifies all members when actorId is null (widget submission)', async () => {
      await service.notifyFeedbackCreated({ feedback, workspaceId, projectId, actorId: null });

      // Both members should get notified
      expect(Notification.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('notifyFeedbackAssigned', () => {
    const feedback = { id: 'fb-1', title: 'Bug', comment: 'Fix this' };
    const projectId = 'proj-1';

    it('creates notification when assigneeId is set and not the actor', async () => {
      await service.notifyFeedbackAssigned({
        feedback, assigneeId: 'user-2', actorId: 'user-1', projectId,
      });

      expect(Notification.create).toHaveBeenCalledWith({
        userId: 'user-2',
        type: 'feedback.assigned',
        title: 'You have been assigned feedback',
        body: 'Bug',
        link: '/dashboard/projects/proj-1/feedback/fb-1',
      });
    });

    it('skips notification when assignee is the actor', async () => {
      await service.notifyFeedbackAssigned({
        feedback, assigneeId: 'user-1', actorId: 'user-1', projectId,
      });

      expect(Notification.create).not.toHaveBeenCalled();
    });

    it('skips notification when assigneeId is null', async () => {
      await service.notifyFeedbackAssigned({
        feedback, assigneeId: null, actorId: 'user-1', projectId,
      });

      expect(Notification.create).not.toHaveBeenCalled();
    });
  });

  describe('notifyFeedbackStatusChanged', () => {
    it('notifies the assignee when status changes', async () => {
      const feedback = { id: 'fb-1', title: 'Bug', assigneeId: 'user-2', status: 'done' };

      await service.notifyFeedbackStatusChanged({
        feedback, actorId: 'user-1', projectId: 'proj-1',
      });

      expect(Notification.create).toHaveBeenCalledWith({
        userId: 'user-2',
        type: 'feedback.status_changed',
        title: 'Feedback status changed to done',
        body: 'Bug',
        link: '/dashboard/projects/proj-1/feedback/fb-1',
      });
    });

    it('skips notification when feedback has no assignee', async () => {
      const feedback = { id: 'fb-1', title: 'Bug', assigneeId: null, status: 'open' };

      await service.notifyFeedbackStatusChanged({
        feedback, actorId: 'user-1', projectId: 'proj-1',
      });

      expect(Notification.create).not.toHaveBeenCalled();
    });

    it('skips notification when assignee is the actor', async () => {
      const feedback = { id: 'fb-1', title: 'Bug', assigneeId: 'user-1', status: 'done' };

      await service.notifyFeedbackStatusChanged({
        feedback, actorId: 'user-1', projectId: 'proj-1',
      });

      expect(Notification.create).not.toHaveBeenCalled();
    });
  });

  describe('notifyCommentAdded', () => {
    it('notifies the feedback assignee', async () => {
      const feedback = { id: 'fb-1', assigneeId: 'user-2' };
      const comment = { body: 'New comment on this feedback' };

      await service.notifyCommentAdded({
        feedback, comment, actorId: 'user-1', projectId: 'proj-1',
      });

      expect(Notification.create).toHaveBeenCalledWith({
        userId: 'user-2',
        type: 'comment.added',
        title: 'New comment on feedback',
        body: 'New comment on this feedback',
        link: '/dashboard/projects/proj-1/feedback/fb-1',
      });
    });

    it('skips when feedback has no assignee', async () => {
      const feedback = { id: 'fb-1', assigneeId: null };
      const comment = { body: 'Comment' };

      await service.notifyCommentAdded({
        feedback, comment, actorId: 'user-1', projectId: 'proj-1',
      });

      expect(Notification.create).not.toHaveBeenCalled();
    });

    it('skips when assignee is the comment author', async () => {
      const feedback = { id: 'fb-1', assigneeId: 'user-1' };
      const comment = { body: 'Comment' };

      await service.notifyCommentAdded({
        feedback, comment, actorId: 'user-1', projectId: 'proj-1',
      });

      expect(Notification.create).not.toHaveBeenCalled();
    });
  });

  describe('emitActivity', () => {
    it('emits activity to the feedback room', () => {
      const io = { to: vi.fn().mockReturnValue({ emit: vi.fn() }) };
      const activity = { id: 'act-1', action: 'created' };

      service.emitActivity(io, 'fb-1', activity);

      expect(io.to).toHaveBeenCalledWith('feedback:fb-1');
      expect(io.to('feedback:fb-1').emit).toHaveBeenCalledWith('activity:new', activity);
    });

    it('logs a warning when io is not available', () => {
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      service.emitActivity(null, 'fb-1', { id: 'act-1' });

      expect(warnSpy).toHaveBeenCalledWith(
        '[Socket.io] io not available, skipping emit'
      );
    });
  });
});
