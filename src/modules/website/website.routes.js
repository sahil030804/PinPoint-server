import { Router } from 'express';
import { Website, Project, Workspace } from '../../database/models/index.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success } from '../../common/utils/response.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { addWebsiteSchema, updateWebsiteSchema } from './website.validation.js';
import { NotFoundError } from '../../common/errors/AppError.js';
import { requireProjectAccess, requireWebsiteAccess } from '../../common/middleware/authorizeWorkspace.js';
import { authorize } from '../../common/middleware/authorize.js';
import { PLAN_LIMITS } from '../../common/plan.js';

const router = Router();
router.use(authenticate);

// List websites in a project
router.get('/project/:projectId', requireProjectAccess, asyncHandler(async (req, res) => {
  const websites = await Website.findAll({
    where: { projectId: req.params.projectId },
    order: [['createdAt', 'DESC']],
  });
  res.json(success(websites));
}));

// Add website to project
router.post('/project/:projectId', requireProjectAccess, authorize('owner', 'admin', 'developer'), validate(addWebsiteSchema), asyncHandler(async (req, res) => {
  const project = await Project.findByPk(req.params.projectId, { include: [{ model: Workspace }] });
  if (!project) throw new NotFoundError('Project not found');
  const workspace = project.Workspace;

  let exceeded = false;
  if (workspace) {
    const planLimits = PLAN_LIMITS[workspace.plan] || PLAN_LIMITS.free;
    if (planLimits.websitesPerWorkspace !== Infinity) {
      const count = await Website.count({
        include: [{ model: Project, where: { workspaceId: workspace.id } }],
      });
      if (count >= planLimits.websitesPerWorkspace) {
        exceeded = true;
      }
    }
  }
  if (exceeded) {
    return res.status(429).json({
      success: false,
      error: { code: 'USAGE_LIMIT_EXCEEDED', message: 'Website limit reached. Upgrade to Pro for unlimited websites.' },
    });
  }

  const website = await Website.create({
    url: req.body.url,
    projectId: req.params.projectId,
    widgetConfig: req.body.widgetConfig ?? undefined,
  });
  res.status(201).json(success(website));
}));

// Get website by ID
router.get('/:id', requireWebsiteAccess, asyncHandler(async (req, res) => {
  const website = await Website.findByPk(req.params.id);
  if (!website) throw new NotFoundError('Website not found');
  res.json(success(website));
}));

// Update website config
router.put('/:id', requireWebsiteAccess, authorize('owner', 'admin', 'developer'), validate(updateWebsiteSchema), asyncHandler(async (req, res) => {
  const website = await Website.findByPk(req.params.id);
  if (!website) throw new NotFoundError('Website not found');

  const updates = { ...req.body };
  if (updates.widgetConfig && typeof updates.widgetConfig === 'object') {
    updates.widgetConfig = { ...website.widgetConfig, ...updates.widgetConfig };
  }

  await website.update(updates);
  res.json(success(website));
}));

// Delete website
router.delete('/:id', requireWebsiteAccess, authorize('owner', 'admin', 'developer'), asyncHandler(async (req, res) => {
  const website = await Website.findByPk(req.params.id);
  if (!website) throw new NotFoundError('Website not found');
  await website.destroy();
  res.json(success({ deleted: true }));
}));

export { router as websiteRoutes };
