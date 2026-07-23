import { Router } from 'express';
import { Project, Workspace } from '../../database/models/index.js';
import { sequelize } from '../../config/database.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success } from '../../common/utils/response.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { createProjectSchema, updateProjectSchema } from './project.validation.js';
import { NotFoundError } from '../../common/errors/AppError.js';
import { requireWorkspaceAccess, requireProjectAccess } from '../../common/middleware/authorizeWorkspace.js';
import { authorize } from '../../common/middleware/authorize.js';
import { PLAN_LIMITS } from '../../common/plan.js';

const router = Router();
router.use(authenticate);

// List projects in a workspace
router.get('/workspace/:workspaceId', requireWorkspaceAccess, asyncHandler(async (req, res) => {
  const projects = await Project.findAll({
    where: { workspaceId: req.params.workspaceId },
    attributes: {
      include: [
        [
          sequelize.literal(`(
            SELECT COUNT(*) FROM "websites"
            WHERE "websites"."project_id" = "Project"."id"
          )`),
          'websiteCount',
        ],
        [
          sequelize.literal(`(
            SELECT COUNT(*) FROM "feedback"
            JOIN "websites" ON "feedback"."website_id" = "websites"."id"
            WHERE "websites"."project_id" = "Project"."id"
          )`),
          'feedbackCount',
        ],
        [
          sequelize.literal(`(
            SELECT COUNT(*) FROM "feedback"
            JOIN "websites" ON "feedback"."website_id" = "websites"."id"
            WHERE "websites"."project_id" = "Project"."id"
            AND "feedback"."status" NOT IN ('done', 'closed')
          )`),
          'unresolvedCount',
        ],
        [
          sequelize.literal(`(
            SELECT "websites"."url" FROM "websites"
            WHERE "websites"."project_id" = "Project"."id"
            ORDER BY "websites"."created_at" ASC
            LIMIT 1
          )`),
          'url',
        ],
      ],
    },
    order: [['createdAt', 'DESC']],
  });
  res.json(success(projects));
}));

// Create project
router.post('/workspace/:workspaceId', requireWorkspaceAccess, authorize('owner', 'admin', 'developer'), validate(createProjectSchema), asyncHandler(async (req, res) => {
  const workspace = await Workspace.findByPk(req.params.workspaceId);
  if (!workspace) throw new NotFoundError('Workspace not found');
  const planLimits = PLAN_LIMITS[workspace.plan] || PLAN_LIMITS.free;
  if (planLimits.websitesPerWorkspace !== Infinity) {
    const projectCount = await Project.count({ where: { workspaceId: req.params.workspaceId } });
    if (projectCount >= planLimits.websitesPerWorkspace * 10) {
      return res.status(429).json({
        success: false,
        error: { code: 'USAGE_LIMIT_EXCEEDED', message: 'Project limit reached. Upgrade to Pro for unlimited projects.' },
      });
    }
  }
  const project = await Project.create({
    ...req.body,
    workspaceId: req.params.workspaceId,
  });
  res.status(201).json(success(project));
}));

// Get project by ID
router.get('/:id', requireProjectAccess, asyncHandler(async (req, res) => {
  const project = await Project.findByPk(req.params.id, {
    attributes: {
      include: [
        [
          sequelize.literal(`(
            SELECT COUNT(*) FROM "websites"
            WHERE "websites"."project_id" = "Project"."id"
          )`),
          'websiteCount',
        ],
        [
          sequelize.literal(`(
            SELECT COUNT(*) FROM "feedback"
            JOIN "websites" ON "feedback"."website_id" = "websites"."id"
            WHERE "websites"."project_id" = "Project"."id"
          )`),
          'feedbackCount',
        ],
        [
          sequelize.literal(`(
            SELECT COUNT(*) FROM "feedback"
            JOIN "websites" ON "feedback"."website_id" = "websites"."id"
            WHERE "websites"."project_id" = "Project"."id"
            AND "feedback"."status" NOT IN ('done', 'closed')
          )`),
          'unresolvedCount',
        ],
        [
          sequelize.literal(`(
            SELECT "websites"."url" FROM "websites"
            WHERE "websites"."project_id" = "Project"."id"
            ORDER BY "websites"."created_at" ASC
            LIMIT 1
          )`),
          'url',
        ],
      ],
    },
  });
  if (!project) throw new NotFoundError('Project not found');
  res.json(success(project));
}));

// Update project
router.put('/:id', requireProjectAccess, authorize('owner', 'admin', 'developer'), validate(updateProjectSchema), asyncHandler(async (req, res) => {
  const project = await Project.findByPk(req.params.id);
  if (!project) throw new NotFoundError('Project not found');
  await project.update(req.body);
  res.json(success(project));
}));

// Delete project
router.delete('/:id', requireProjectAccess, authorize('owner', 'admin', 'developer'), asyncHandler(async (req, res) => {
  const project = await Project.findByPk(req.params.id);
  if (!project) throw new NotFoundError('Project not found');
  await project.destroy();
  res.json(success({ deleted: true }));
}));

export { router as projectRoutes };
