import { Router } from 'express';
import { Op } from 'sequelize';
import { sequelize, Feedback, ActivityLog, User, Website, WorkspaceMember } from '../../database/models/index.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success } from '../../common/utils/response.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { paginationMiddleware } from '../../common/middleware/pagination.js';
import { paginationMeta } from '../../common/utils/pagination.js';
import { createFeedbackSchema, updateFeedbackSchema } from '../auth/auth.validation.js';
import { NotFoundError, AuthorizationError } from '../../common/errors/AppError.js';
import { requireWorkspaceAccess, requireWebsiteAccess, requireFeedbackAccess } from '../../common/middleware/authorizeWorkspace.js';
import { authorize } from '../../common/middleware/authorize.js';
import { cacheService } from '../../common/services/cache.service.js';

const router = Router();

// ─── Widget endpoint (no auth required) ───
router.post('/widget/:projectId/feedback', validate(createFeedbackSchema), asyncHandler(async (req, res) => {
  const { Project } = await import('../../database/models/index.js');
  const project = await Project.findByPk(req.params.projectId);
  if (!project) throw new NotFoundError('Project not found');

  const website = await Website.findOne({ where: { projectId: project.id } });
  if (!website) throw new NotFoundError('No website found for this project');

  let screenshot = req.body.screenshot;
  if (typeof screenshot === 'string') {
    screenshot = screenshot ? { clientUrl: screenshot } : null;
  }

  const feedback = await sequelize.transaction(async (tx) => {
    const fb = await Feedback.create({
      websiteId: website.id,
      comment: req.body.comment,
      title: req.body.title,
      pageUrl: req.body.pageUrl,
      coordinates: req.body.coordinates,
      screenshot,
      annotations: req.body.annotations || [],
      metadata: req.body.metadata || {},
      reporterEmail: req.body.reporterEmail,
      reporterName: req.body.reporterName,
    }, { transaction: tx });

    await ActivityLog.create({
      feedbackId: fb.id,
      action: 'created',
      metadata: { source: 'widget' },
    }, { transaction: tx });

    return fb;
  });

  await cacheService.invalidate(`feedback:${website.id}`);

  res.status(201).json(success(feedback));
}));

// ─── Authenticated endpoints ───
router.use(authenticate);

// ─── Workspace feedback listing ───
router.get('/workspace/:workspaceId', requireWorkspaceAccess, paginationMiddleware, asyncHandler(async (req, res) => {
  const { page, limit, offset } = req.pagination;
  const { status, priority, assigneeId, projectId, search } = req.query;

  const where = {};
  if (status) {
    const values = status.split(',').map((s) => s.trim()).filter(Boolean);
    if (values.length === 1) where.status = values[0];
    else where.status = { [Op.in]: values };
  }
  if (priority) where.priority = priority;
  if (assigneeId) where.assigneeId = assigneeId;

  const projectWhere = { workspaceId: req.params.workspaceId };
  if (projectId) projectWhere.id = projectId;

  const { Project } = await import('../../database/models/index.js');

  const { count, rows } = await Feedback.findAndCountAll({
    where,
    include: [
      {
        model: Website,
        required: true,
        attributes: ['id', 'url'],
        include: [{
          model: Project,
          attributes: ['id', 'name', 'color'],
          where: projectWhere,
        }],
      },
      { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'avatarUrl'] },
      { model: User, as: 'reporter', attributes: ['id', 'name', 'email', 'avatarUrl'] },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  res.json(success(rows, paginationMeta(count, page, limit)));
}));

// Get widget config (public)
router.get('/widget/:projectId/config', asyncHandler(async (req, res) => {
  const { Project } = await import('../../database/models/index.js');
  const project = await Project.findByPk(req.params.projectId);
  if (!project) throw new NotFoundError('Project not found');

  const website = await Website.findOne({ where: { projectId: project.id } });
  if (!website) throw new NotFoundError('No website found');

  res.json(success(website.widgetConfig));
}));

// List feedback for a website
router.get('/website/:websiteId', requireWebsiteAccess, paginationMiddleware, asyncHandler(async (req, res) => {
  const { page, limit, offset } = req.pagination;
  const { status, priority, assigneeId, search, tags } = req.query;

  const where = { websiteId: req.params.websiteId };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (assigneeId) where.assigneeId = assigneeId;

  const { count, rows } = await Feedback.findAndCountAll({
    where,
    include: [
      { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'avatarUrl'] },
      { model: User, as: 'reporter', attributes: ['id', 'name', 'email', 'avatarUrl'] },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  res.json(success(rows, paginationMeta(count, page, limit)));
}));

// Get single feedback
router.get('/:id', requireFeedbackAccess, asyncHandler(async (req, res) => {
  const feedback = await Feedback.findByPk(req.params.id, {
    include: [
      { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'avatarUrl'] },
      { model: User, as: 'reporter', attributes: ['id', 'name', 'email', 'avatarUrl'] },
      { model: Feedback, as: 'duplicate', attributes: ['id', 'title', 'pageUrl', 'status'] },
    ],
  });
  if (!feedback) throw new NotFoundError('Feedback not found');
  res.json(success(feedback));
}));

// Update feedback
router.put('/:id', requireFeedbackAccess, validate(updateFeedbackSchema), asyncHandler(async (req, res) => {
  const role = req.membership.role;

  // Field-level permission checks
  if (req.body.annotations !== undefined) {
    if (!['owner', 'admin', 'developer'].includes(role)) {
      throw new AuthorizationError('Only developers and above can annotate screenshots');
    }
  }

  if (req.body.assigneeId !== undefined) {
    if (!['owner', 'admin', 'developer'].includes(role)) {
      throw new AuthorizationError('Only developers and above can assign feedback');
    }
    if (req.body.assigneeId !== null) {
      const assignee = await WorkspaceMember.findOne({
        where: { userId: req.body.assigneeId, workspaceId: req.membership.workspaceId },
      });
      if (!assignee) {
        throw new AuthorizationError('Assignee must be a workspace member');
      }
    }
  }

  const mutableFields = ['status', 'priority', 'tags'];
  const hasMutableChanges = Object.keys(req.body).some((k) => mutableFields.includes(k));
  if (hasMutableChanges && (role === 'client' || role === 'viewer')) {
    throw new AuthorizationError('Clients and viewers cannot update feedback');
  }

  const feedback = await sequelize.transaction(async (tx) => {
    const fb = await Feedback.findByPk(req.params.id, { transaction: tx });
    if (!fb) throw new NotFoundError('Feedback not found');

    const changes = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (value !== undefined && fb[key] !== value) {
        changes[key] = { from: fb[key], to: value };
      }
    }

    await fb.update(req.body, { transaction: tx });

    for (const [field, change] of Object.entries(changes)) {
      if (field === 'annotations') continue;
      let action;
      if (field === 'status') {
        action = change.to === 'done' || change.to === 'closed' ? 'resolved' : 'status_changed';
      } else if (field === 'priority') {
        action = 'priority_changed';
      } else if (field === 'assigneeId') {
        action = change.to ? 'assigned' : 'unassigned';
        if (change.to) {
          const assignee = await User.findByPk(change.to, { attributes: ['name'] });
          change.assigneeName = assignee?.name || 'Unknown';
        }
      } else if (field === 'tags') {
        action = 'tag_added';
      } else {
        action = 'status_changed';
      }

      await ActivityLog.create({
        feedbackId: fb.id,
        actorId: req.user.id,
        action,
        metadata: change,
      }, { transaction: tx });
    }

    return fb;
  });

  await cacheService.invalidate(`feedback:${feedback.websiteId}`);
  res.json(success(feedback));
}));

// Delete feedback
router.delete('/:id', requireFeedbackAccess, authorize('owner', 'admin', 'developer'), asyncHandler(async (req, res) => {
  const feedback = await Feedback.findByPk(req.params.id);
  if (!feedback) throw new NotFoundError('Feedback not found');
  await feedback.destroy();
  res.json(success({ deleted: true }));
}));

export { router as feedbackRoutes };
