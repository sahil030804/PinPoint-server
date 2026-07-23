import { Router } from 'express';
import { Op, Sequelize } from 'sequelize';
import { Workspace, WorkspaceMember, User, Invitation, Feedback, Website, Project } from '../../database/models/index.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success, error } from '../../common/utils/response.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';
import { slugify } from '../../common/utils/slugify.js';
import { createWorkspaceSchema, updateWorkspaceSchema, inviteMemberSchema, updateMemberSchema } from '../auth/auth.validation.js';
import { NotFoundError, ConflictError, AuthorizationError } from '../../common/errors/AppError.js';
import { requireWorkspaceAccess } from '../../common/middleware/authorizeWorkspace.js';
import { authorize } from '../../common/middleware/authorize.js';
import { emailService } from '../../common/services/email.service.js';
import { env } from '../../config/env.js';
import { PLAN_LIMITS } from '../../common/plan.js';

const router = Router();
router.use(authenticate);

// ─── Invitations (must be before /:id to avoid matching 'invitations' as a UUID) ───

// Get pending invitations for the current user
router.get('/invitations', asyncHandler(async (req, res) => {
  const invitations = await Invitation.findAll({
    where: { email: req.user.email, status: 'pending' },
    include: [{ model: Workspace, attributes: ['id', 'name', 'slug'] }],
    order: [['createdAt', 'DESC']],
  });
  res.json(success(invitations));
}));

// Accept invitation
router.post('/invitations/:id/accept', asyncHandler(async (req, res) => {
  const invitation = await Invitation.findByPk(req.params.id);
  if (!invitation) throw new NotFoundError('Invitation not found');
  if (invitation.email !== req.user.email) throw new AuthorizationError('This invitation is not for you');
  if (invitation.status !== 'pending') throw new ConflictError('Invitation is no longer pending');

  const existing = await WorkspaceMember.findOne({
    where: { workspaceId: invitation.workspaceId, userId: req.user.id },
  });
  if (!existing) {
    await WorkspaceMember.create({
      workspaceId: invitation.workspaceId,
      userId: req.user.id,
      role: invitation.role,
    });
  }

  await invitation.update({ status: 'accepted', acceptedAt: new Date() });
  res.json(success({ message: 'Invitation accepted' }));
}));

// Reject invitation
router.post('/invitations/:id/reject', asyncHandler(async (req, res) => {
  const invitation = await Invitation.findByPk(req.params.id);
  if (!invitation) throw new NotFoundError('Invitation not found');
  if (invitation.email !== req.user.email) throw new AuthorizationError('This invitation is not for you');
  if (invitation.status !== 'pending') throw new ConflictError('Invitation is no longer pending');

  await invitation.update({ status: 'rejected' });
  res.json(success({ message: 'Invitation rejected' }));
}));

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

// Get workspace by ID (includes plan info and limits)
router.get('/:id', requireWorkspaceAccess, asyncHandler(async (req, res) => {
  const workspace = await Workspace.findByPk(req.params.id);
  if (!workspace) throw new NotFoundError('Workspace not found');
  const planLimits = PLAN_LIMITS[workspace.plan] || PLAN_LIMITS.free;
  res.json(success({
    ...workspace.toJSON(),
    planLimits,
  }));
}));

// Get workspace usage stats
router.get('/:id/stats', requireWorkspaceAccess, asyncHandler(async (req, res) => {
  const workspace = await Workspace.findByPk(req.params.id, {
    attributes: ['id', 'plan', 'feedbackMonthlyCount', 'feedbackLimitResetAt'],
  });
  if (!workspace) throw new NotFoundError('Workspace not found');

  const now = new Date();
  const resetAt = workspace.feedbackLimitResetAt;
  if (!resetAt || resetAt <= now) {
    const [updated] = await Workspace.update({
      feedbackMonthlyCount: 0,
      feedbackLimitResetAt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
    }, {
      where: { id: req.params.id, feedbackLimitResetAt: resetAt },
    });
    if (updated > 0) {
      workspace.feedbackMonthlyCount = 0;
      workspace.feedbackLimitResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
  }

  const planLimits = PLAN_LIMITS[workspace.plan] || PLAN_LIMITS.free;
  const feedbackCount = await Feedback.count({
    include: [{
      model: Website,
      include: [{ model: Project, where: { workspaceId: req.params.id } }],
    }],
  });

  const websiteCount = await Website.count({
    include: [{
      model: Project,
      where: { workspaceId: req.params.id },
    }],
  });

  const memberCount = await WorkspaceMember.count({
    where: { workspaceId: req.params.id },
  });

  res.json(success({
    plan: workspace.plan,
    planLimits,
    usage: {
      feedback: { current: feedbackCount, limit: planLimits.feedbackPerMonth },
      websites: { current: websiteCount, limit: planLimits.websitesPerWorkspace },
      members: { current: memberCount, limit: planLimits.membersPerWorkspace },
    },
    feedbackLimitResetAt: workspace.feedbackLimitResetAt,
  }));
}));

// Update workspace
router.put('/:id', requireWorkspaceAccess, authorize('owner', 'admin'), validate(updateWorkspaceSchema), asyncHandler(async (req, res) => {
  const workspace = await Workspace.findByPk(req.params.id);
  if (!workspace) throw new NotFoundError('Workspace not found');

  const updates = { ...req.body };
  if (updates.logoData !== undefined) {
    updates.logoUrl = updates.logoData;
  }
  delete updates.logoData;

  await workspace.update(updates);
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
  const workspace = await Workspace.findByPk(req.params.id);
  if (!workspace) throw new NotFoundError('Workspace not found');

  const planLimits = PLAN_LIMITS[workspace.plan] || PLAN_LIMITS.free;
  if (planLimits.membersPerWorkspace !== Infinity) {
    const memberCount = await WorkspaceMember.count({ where: { workspaceId: req.params.id } });
    if (memberCount >= planLimits.membersPerWorkspace) {
      return res.status(429).json({
        success: false,
        error: { code: 'USAGE_LIMIT_EXCEEDED', message: 'Team member limit reached. Upgrade to Pro for unlimited members.' },
      });
    }
  }

  const existingUser = await User.findOne({ where: { email: req.body.email } });

  if (existingUser) {
    const existing = await WorkspaceMember.findOne({
      where: { workspaceId: req.params.id, userId: existingUser.id },
    });
    if (existing) throw new ConflictError('User is already a member');
  }

  const pending = await Invitation.findOne({
    where: { workspaceId: req.params.id, email: req.body.email, status: 'pending' },
  });
  if (pending) throw new ConflictError('Invitation already sent to this email');

  const invitation = await Invitation.create({
    workspaceId: req.params.id,
    invitedByUserId: req.user.id,
    email: req.body.email,
    role: req.body.role || 'viewer',
    status: 'pending',
  });

  const workspaceName = workspace?.name || 'a workspace';
  const appUrl = env.auth.appUrl || 'http://localhost:3000';
  const inviteUrl = `${appUrl}/auth/register?invitation=${invitation.id}`;

  // Send invitation email
  await emailService.sendInvitationEmail({
    toEmail: req.body.email,
    workspaceName,
    invitedByName: req.user.name || 'Someone',
    inviteUrl,
  });

  res.status(201).json(success({ invitation, message: 'Invitation sent.' }));
}));

async function checkNotLastOwner(workspaceId, userId) {
  const member = await WorkspaceMember.findOne({
    where: { workspaceId, userId },
  });
  if (member && member.role === 'owner') {
    const ownerCount = await WorkspaceMember.count({ where: { workspaceId, role: 'owner' } });
    if (ownerCount <= 1) {
      throw new AuthorizationError('Cannot remove or demote the last owner of the workspace');
    }
  }
  return member;
}

// Update member role
router.put('/:id/members/:userId', requireWorkspaceAccess, authorize('owner', 'admin'), validate(updateMemberSchema), asyncHandler(async (req, res) => {
  const member = await checkNotLastOwner(req.params.id, req.params.userId);
  if (!member) throw new NotFoundError('Member not found');
  await member.update({ role: req.body.role });
  res.json(success(member));
}));

// Remove member
router.delete('/:id/members/:userId', requireWorkspaceAccess, authorize('owner', 'admin'), asyncHandler(async (req, res) => {
  const member = await checkNotLastOwner(req.params.id, req.params.userId);
  if (!member) throw new NotFoundError('Member not found');
  await member.destroy();
  res.json(success({ removed: true }));
}));

export { router as workspaceRoutes };
