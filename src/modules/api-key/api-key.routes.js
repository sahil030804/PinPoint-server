import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { ApiKey, WorkspaceMember } from '../../database/models/index.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success } from '../../common/utils/response.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authorize } from '../../common/middleware/authorize.js';
import { BadRequestError, NotFoundError, AuthorizationError } from '../../common/errors/AppError.js';

const router = Router();
router.use(authenticate);

router.use(asyncHandler(async (req, res, next) => {
  const workspaceId = req.user?.workspaceId;
  if (!workspaceId) throw new BadRequestError('Workspace context required');

  const membership = await WorkspaceMember.findOne({
    where: { userId: req.user.id, workspaceId },
  });
  if (!membership) throw new AuthorizationError('Not a member of this workspace');

  req.membership = membership;
  next();
}));

router.get('/', authorize('owner', 'admin'), asyncHandler(async (req, res) => {
  const keys = await ApiKey.findAll({
    where: { workspaceId: req.membership.workspaceId },
    attributes: ['id', 'name', 'keyPrefix', 'role', 'lastUsedAt', 'expiresAt', 'createdAt'],
    order: [['createdAt', 'DESC']],
  });
  res.json(success(keys));
}));

router.post('/', authorize('owner', 'admin'), asyncHandler(async (req, res) => {
  const { name, role } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new BadRequestError('Name is required');
  }
  const allowedRoles = ['owner', 'admin', 'developer', 'viewer', 'client'];
  const keyRole = role && allowedRoles.includes(role) ? role : 'developer';

  const raw = 'pp_' + crypto.randomBytes(32).toString('hex');
  const keyHash = await bcrypt.hash(raw, 12);
  const keyPrefix = raw.slice(0, 16);

  const apiKey = await ApiKey.create({
    workspaceId: req.membership.workspaceId,
    name: name.trim(),
    keyHash,
    keyPrefix,
    role: keyRole,
  });

  res.status(201).json(success({
    id: apiKey.id,
    name: apiKey.name,
    key: raw,
    keyPrefix: apiKey.keyPrefix,
    role: apiKey.role,
    createdAt: apiKey.createdAt,
  }));
}));

router.delete('/:id', authorize('owner', 'admin'), asyncHandler(async (req, res) => {
  const apiKey = await ApiKey.findOne({
    where: { id: req.params.id, workspaceId: req.membership.workspaceId },
  });
  if (!apiKey) throw new NotFoundError('API key not found');
  await apiKey.destroy();
  res.json(success({ deleted: true }));
}));

export { router as apiKeyRoutes };
