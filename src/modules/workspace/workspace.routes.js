import { Router } from 'express';
import { Workspace, WorkspaceMember, User } from '../../database/models/index.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success, error } from '../../common/utils/response.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { slugify } from '../../common/utils/slugify.js';
import { createWorkspaceSchema, inviteMemberSchema, updateMemberSchema } from '../auth/auth.validation.js';
import { NotFoundError, ConflictError, AuthorizationError } from '../../common/errors/AppError.js';
import { requireWorkspaceAccess } from '../../common/middleware/authorizeWorkspace.js';
import { authorize } from '../../common/middleware/authorize.js';

const router = Router();
router.use(authenticate);

// List workspaces for the current user
router.get('/', asyncHandler(async (req, res) => {
  const memberships = await WorkspaceMember.findAll({
    where: { userId: req.user.id },
    include: [{ model: Workspace }],
  });
  const workspaces = memberships.map((m) => m.Workspace);
  res.json(success(workspaces));
}));

// Create workspace
router.post('/', validate(createWorkspaceSchema), asyncHandler(async (req, res) => {
  const workspace = await Workspace.create({
    name: req.body.name,
    slug: slugify(req.body.name) + '-' + Date.now().toString(36),
  });

  await WorkspaceMember.create({
    workspaceId: workspace.id,
    userId: req.user.id,
    role: 'owner',
  });

  res.status(201).json(success(workspace));
}));

// Get workspace by ID
router.get('/:id', requireWorkspaceAccess, asyncHandler(async (req, res) => {
  const workspace = await Workspace.findByPk(req.params.id);
  if (!workspace) throw new NotFoundError('Workspace not found');
  res.json(success(workspace));
}));

// Update workspace
router.put('/:id', requireWorkspaceAccess, authorize('owner', 'admin'), asyncHandler(async (req, res) => {
  const workspace = await Workspace.findByPk(req.params.id);
  if (!workspace) throw new NotFoundError('Workspace not found');
  await workspace.update(req.body);
  res.json(success(workspace));
}));

// Delete workspace
router.delete('/:id', requireWorkspaceAccess, authorize('owner'), asyncHandler(async (req, res) => {
  const workspace = await Workspace.findByPk(req.params.id);
  if (!workspace) throw new NotFoundError('Workspace not found');
  await workspace.destroy();
  res.json(success({ deleted: true }));
}));

// ─── Members ───

// List members
router.get('/:id/members', requireWorkspaceAccess, asyncHandler(async (req, res) => {
  const members = await WorkspaceMember.findAll({
    where: { workspaceId: req.params.id },
    include: [{ model: User, attributes: ['id', 'email', 'name', 'avatarUrl'] }],
  });
  res.json(success(members));
}));

// Invite member
router.post('/:id/members', requireWorkspaceAccess, authorize('owner', 'admin'), validate(inviteMemberSchema), asyncHandler(async (req, res) => {
  const user = await User.findOne({ where: { email: req.body.email } });
  if (!user) throw new NotFoundError('User not found with that email');

  const existing = await WorkspaceMember.findOne({
    where: { workspaceId: req.params.id, userId: user.id },
  });
  if (existing) throw new ConflictError('User is already a member');

  const member = await WorkspaceMember.create({
    workspaceId: req.params.id,
    userId: user.id,
    role: req.body.role || 'viewer',
  });

  res.status(201).json(success(member));
}));

// Update member role
router.put('/:id/members/:userId', requireWorkspaceAccess, authorize('owner', 'admin'), validate(updateMemberSchema), asyncHandler(async (req, res) => {
  const member = await WorkspaceMember.findOne({
    where: { workspaceId: req.params.id, userId: req.params.userId },
  });
  if (!member) throw new NotFoundError('Member not found');
  await member.update({ role: req.body.role });
  res.json(success(member));
}));

// Remove member
router.delete('/:id/members/:userId', requireWorkspaceAccess, authorize('owner', 'admin'), asyncHandler(async (req, res) => {
  const member = await WorkspaceMember.findOne({
    where: { workspaceId: req.params.id, userId: req.params.userId },
  });
  if (!member) throw new NotFoundError('Member not found');
  await member.destroy();
  res.json(success({ removed: true }));
}));

export { router as workspaceRoutes };
