import { Router } from 'express';
import { Project } from '../../database/models/index.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success } from '../../common/utils/response.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { createProjectSchema } from '../auth/auth.validation.js';
import { NotFoundError } from '../../common/errors/AppError.js';
import { requireWorkspaceAccess, requireProjectAccess } from '../../common/middleware/authorizeWorkspace.js';
import { authorize } from '../../common/middleware/authorize.js';

const router = Router();
router.use(authenticate);

// List projects in a workspace
router.get('/workspace/:workspaceId', requireWorkspaceAccess, asyncHandler(async (req, res) => {
  const projects = await Project.findAll({
    where: { workspaceId: req.params.workspaceId },
    order: [['createdAt', 'DESC']],
  });
  res.json(success(projects));
}));

// Create project
router.post('/workspace/:workspaceId', requireWorkspaceAccess, authorize('owner', 'admin', 'developer'), validate(createProjectSchema), asyncHandler(async (req, res) => {
  const project = await Project.create({
    ...req.body,
    workspaceId: req.params.workspaceId,
  });
  res.status(201).json(success(project));
}));

// Get project by ID
router.get('/:id', requireProjectAccess, asyncHandler(async (req, res) => {
  const project = await Project.findByPk(req.params.id);
  if (!project) throw new NotFoundError('Project not found');
  res.json(success(project));
}));

// Update project
router.put('/:id', requireProjectAccess, authorize('owner', 'admin', 'developer'), asyncHandler(async (req, res) => {
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
