import { Router } from 'express';
import { Op, Sequelize } from 'sequelize';
import { sequelize, Feedback, ActivityLog, User, Website, Project, Workspace, WorkspaceMember } from '../../database/models/index.js';
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
import { notificationService } from '../../common/services/notification.service.js';
import { screenshotService } from '../../common/services/screenshot.service.js';
import { emailService } from '../../common/services/email.service.js';
import { PLAN_LIMITS } from '../../common/plan.js';

const router = Router();

function getSocketIo(req) {
  return req.app.get('io');
}

function buildCacheKey(prefix, params) {
  const filtered = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      filtered[k] = v;
    }
  }
  return `${prefix}:${JSON.stringify(filtered)}`;
}

// ─── Widget endpoint (no auth required) ───
router.post('/widget/:projectId/feedback', validate(createFeedbackSchema), asyncHandler(async (req, res) => {
  const project = await Project.findByPk(req.params.projectId, {
    include: [{ model: Website }, { model: Workspace }],
  });
  if (!project) throw new NotFoundError('Project not found');

  const website = project.Websites?.[0];
  if (!website) throw new NotFoundError('No website found for this project');

  const workspace = project.Workspace;
  if (workspace) {
    const planLimits = PLAN_LIMITS[workspace.plan] || PLAN_LIMITS.free;
    if (planLimits.feedbackPerMonth !== Infinity) {
      const now = new Date();
      const resetAt = workspace.feedbackLimitResetAt;
      if (!resetAt || resetAt <= now) {
        await workspace.update({
          feedbackMonthlyCount: 0,
          feedbackLimitResetAt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        });
        workspace.feedbackMonthlyCount = 0;
        workspace.feedbackLimitResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      }
      if (workspace.feedbackMonthlyCount >= planLimits.feedbackPerMonth) {
        return res.status(429).json({
          success: false,
          error: { code: 'USAGE_LIMIT_EXCEEDED', message: 'Monthly feedback limit reached. Upgrade to Pro for unlimited feedback.' },
        });
      }
    }
  }

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

  // ─── Screenshot upload (fire-and-forget) ───
  const screenshotClientUrl = req.body.screenshot;
  if (screenshotClientUrl && typeof screenshotClientUrl === 'string') {
    const serverUrl = await screenshotService.uploadScreenshot(
      screenshotClientUrl, project.workspaceId, feedback.id
    );
    if (serverUrl) {
      await feedback.update({ screenshot: { clientUrl: screenshotClientUrl, serverUrl } });
    }
  }

  // ─── Duplicate detection ───
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
  const duplicates = await Feedback.findAll({
    where: {
      pageUrl: feedback.pageUrl,
      id: { [Op.ne]: feedback.id },
      createdAt: { [Op.gte]: thirtyMinAgo },
    },
  });

  const feedbackCoords = feedback.coordinates;
  let duplicateOf = null;
  if (feedbackCoords?.x != null && feedbackCoords?.y != null) {
    for (const potential of duplicates) {
      const c = potential.coordinates;
      if (c?.x != null && c?.y != null) {
        const dist = Math.sqrt(
          (feedbackCoords.x - c.x) ** 2 + (feedbackCoords.y - c.y) ** 2
        );
        if (dist <= 50) {
          duplicateOf = potential.id;
          break;
        }
      }
    }
  }

  if (duplicateOf) {
    await feedback.update({ duplicateOf });
    await ActivityLog.create({
      feedbackId: feedback.id,
      action: 'duplicate_marked',
      metadata: { duplicateOf },
    });
  }

  const activity = await ActivityLog.findOne({
    where: { feedbackId: feedback.id, action: 'created' },
    order: [['createdAt', 'DESC']],
  });

  notificationService.notifyFeedbackCreated({
    feedback,
    workspaceId: project.workspaceId,
    projectId: project.id,
    actorId: null,
  });

  const io = getSocketIo(req);
  if (activity) {
    notificationService.emitActivity(io, feedback.id, activity);
  }

  await cacheService.invalidate(`feedback:workspace:${project.workspaceId}`);
  await cacheService.invalidate(`feedback:website:${website.id}`);

  workspace?.increment({ feedbackMonthlyCount: 1 }).catch(() => {});

  res.status(201).json(success(feedback));
}));

// Widget config (public)
router.get('/widget/:projectId/config', asyncHandler(async (req, res) => {
  const project = await Project.findByPk(req.params.projectId, {
    include: [
      { model: Website },
      { model: Workspace, attributes: ['id', 'plan', 'theme'] },
    ],
  });
  if (!project) throw new NotFoundError('Project not found');

  const website = project.Websites?.[0];
  if (!website) throw new NotFoundError('No website found');

  const workspace = project.Workspace;
  const planLimits = PLAN_LIMITS[workspace?.plan] || PLAN_LIMITS.free;

  res.json(success({
    ...website.widgetConfig,
    whiteLabel: planLimits.whiteLabel,
  }));
}));

// ─── Authenticated endpoints ───
router.use(authenticate);

// ─── Workspace feedback listing ───
router.get('/workspace/:workspaceId', requireWorkspaceAccess, paginationMiddleware, asyncHandler(async (req, res) => {
  const { page, limit, offset } = req.pagination;
  const { status, priority, assigneeId, projectId, search, q } = req.query;

  const cacheKey = buildCacheKey('feedback:workspace', {
    workspaceId: req.params.workspaceId,
    status, priority, assigneeId, projectId, search, q, page, limit,
  });

  const cached = await cacheService.get(cacheKey);
  if (cached) return res.json(success(cached.rows, cached.pagination));

  const where = {};
  if (status) {
    const values = status.split(',').map((s) => s.trim()).filter(Boolean);
    if (values.length === 1) where.status = values[0];
    else where.status = { [Op.in]: values };
  }
  if (priority) where.priority = priority;
  if (assigneeId) where.assigneeId = assigneeId;

  const searchTerm = search || q;
  if (searchTerm) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${searchTerm}%` } },
      { comment: { [Op.iLike]: `%${searchTerm}%` } },
      { reporterName: { [Op.iLike]: `%${searchTerm}%` } },
      { reporterEmail: { [Op.iLike]: `%${searchTerm}%` } },
    ];
  }

  const projectWhere = { workspaceId: req.params.workspaceId };
  if (projectId) projectWhere.id = projectId;

  const { count, rows } = await Feedback.findAndCountAll({
    where,
    include: [
      {
        model: Website,
        required: true,
        attributes: ['id', 'url'],
        include: [{
          model: Project,
          attributes: ['id', 'name', 'color', 'workspaceId'],
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

  const pagination = paginationMeta(count, page, limit);
  await cacheService.set(cacheKey, { rows, pagination }, 300);
  res.json(success(rows, pagination));
}));

// ─── Website feedback listing ───
router.get('/website/:websiteId', requireWebsiteAccess, paginationMiddleware, asyncHandler(async (req, res) => {
  const { page, limit, offset } = req.pagination;
  const { status, priority, assigneeId, search, q, tags } = req.query;

  const cacheKey = buildCacheKey('feedback:website', {
    websiteId: req.params.websiteId,
    status, priority, assigneeId, search, q, tags, page, limit,
  });

  const cached = await cacheService.get(cacheKey);
  if (cached) return res.json(success(cached.rows, cached.pagination));

  const where = { websiteId: req.params.websiteId };
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (assigneeId) where.assigneeId = assigneeId;

  const searchTerm = search || q;
  if (searchTerm) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${searchTerm}%` } },
      { comment: { [Op.iLike]: `%${searchTerm}%` } },
      { reporterName: { [Op.iLike]: `%${searchTerm}%` } },
      { reporterEmail: { [Op.iLike]: `%${searchTerm}%` } },
    ];
  }

  if (tags) {
    const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (tagList.length > 0) {
      where.tags = { [Op.overlap]: tagList };
    }
  }

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

  const pagination = paginationMeta(count, page, limit);
  await cacheService.set(cacheKey, { rows, pagination }, 300);
  res.json(success(rows, pagination));
}));

// ─── Get single feedback ───
router.get('/:id', requireFeedbackAccess, asyncHandler(async (req, res) => {
  const feedback = await Feedback.findByPk(req.params.id, {
    include: [
      { model: User, as: 'assignee', attributes: ['id', 'name', 'email', 'avatarUrl'] },
      { model: User, as: 'reporter', attributes: ['id', 'name', 'email', 'avatarUrl'] },
      { model: Feedback, as: 'duplicate', attributes: ['id', 'title', 'pageUrl', 'status'] },
      {
        model: Website,
        attributes: ['id', 'url', 'projectId'],
        include: [{ model: Project, attributes: ['id', 'name', 'workspaceId'] }],
      },
    ],
  });
  if (!feedback) throw new NotFoundError('Feedback not found');
  res.json(success(feedback));
}));

// ─── Update feedback ───
router.put('/:id', requireFeedbackAccess, validate(updateFeedbackSchema), asyncHandler(async (req, res) => {
  const role = req.membership.role;

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

  const io = getSocketIo(req);

  const feedback = await sequelize.transaction(async (tx) => {
    const fb = await Feedback.findByPk(req.params.id, {
      include: [{
        model: Website,
        attributes: ['id', 'projectId'],
        include: [{ model: Project, attributes: ['id', 'workspaceId'] }],
      }],
      transaction: tx,
    });
    if (!fb) throw new NotFoundError('Feedback not found');

    const previousAssigneeId = fb.assigneeId;
    const previousStatus = fb.status;

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

      const activity = await ActivityLog.create({
        feedbackId: fb.id,
        actorId: req.user.id,
        action,
        metadata: change,
      }, { transaction: tx });

      if (activity) {
        notificationService.emitActivity(io, fb.id, activity);
      }
    }

    return fb;
  });

  const website = feedback.Website || await Website.findByPk(feedback.websiteId, {
    include: [{ model: Project, attributes: ['id', 'workspaceId'] }],
  });
  const projectId = website?.Project?.id || website?.project?.id;
  const wsId = website?.Project?.workspaceId || website?.project?.workspaceId;

  if (req.body.assigneeId !== undefined && req.body.assigneeId !== null) {
    await notificationService.notifyFeedbackAssigned({
      feedback,
      assigneeId: req.body.assigneeId,
      actorId: req.user.id,
      projectId,
    });

    const assigneeUser = await User.findByPk(req.body.assigneeId, { attributes: ['email', 'name'] });
    if (assigneeUser?.email) {
      emailService.sendAssignmentEmail({
        toEmail: assigneeUser.email,
        toName: assigneeUser.name,
        feedbackTitle: feedback.title || feedback.comment,
        feedbackId: feedback.id,
        projectId,
        assignerName: req.user.name,
      });
    }
  }

  if (req.body.status) {
    await notificationService.notifyFeedbackStatusChanged({
      feedback,
      actorId: req.user.id,
      projectId,
    });

    if (feedback.assigneeId) {
      const assigneeUser = await User.findByPk(feedback.assigneeId, { attributes: ['email', 'name'] });
      if (assigneeUser?.email) {
        emailService.sendStatusChangeEmail({
          toEmail: assigneeUser.email,
          toName: assigneeUser.name,
          feedbackTitle: feedback.title || feedback.comment,
          feedbackId: feedback.id,
          projectId,
          newStatus: req.body.status,
          changerName: req.user.name,
        });
      }
    }
  }

  await cacheService.invalidate(`feedback:workspace:${wsId}`);
  await cacheService.invalidate(`feedback:website:${feedback.websiteId}`);
  res.json(success(feedback));
}));

// ─── Delete feedback ───
router.delete('/:id', requireFeedbackAccess, authorize('owner', 'admin', 'developer'), asyncHandler(async (req, res) => {
  const feedback = await Feedback.findByPk(req.params.id, {
    include: [{
      model: Website,
      attributes: ['id', 'projectId'],
      include: [{ model: Project, attributes: ['workspaceId'] }],
    }],
  });
  if (!feedback) throw new NotFoundError('Feedback not found');

  const workspaceId = feedback.Website?.Project?.workspaceId;
  await feedback.destroy();

  if (workspaceId) {
    await cacheService.invalidate(`feedback:workspace:${workspaceId}`);
  }
  await cacheService.invalidate(`feedback:website:${feedback.websiteId}`);

  res.json(success({ deleted: true }));
}));

export { router as feedbackRoutes };
