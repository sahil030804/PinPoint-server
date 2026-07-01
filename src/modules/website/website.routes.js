import { Router } from 'express';
import { Website } from '../../database/models/index.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success } from '../../common/utils/response.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { addWebsiteSchema, updateWebsiteSchema } from '../auth/auth.validation.js';
import { NotFoundError } from '../../common/errors/AppError.js';
import { requireProjectAccess, requireWebsiteAccess } from '../../common/middleware/authorizeWorkspace.js';
import { authorize } from '../../common/middleware/authorize.js';

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
  const website = await Website.create({
    url: req.body.url,
    projectId: req.params.projectId,
    widgetConfig: req.body.widgetConfig || undefined,
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
  await website.update(req.body);
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
