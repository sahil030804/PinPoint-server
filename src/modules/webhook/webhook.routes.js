import { Router } from 'express';
import crypto from 'node:crypto';
import { Workspace, WorkspaceMember } from '../../database/models/index.js';
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

function getWebhooks(workspace) {
  return workspace.theme?.webhooks || [];
}

async function getWorkspace(workspaceId) {
  const workspace = await Workspace.findByPk(workspaceId);
  if (!workspace) throw new NotFoundError('Workspace not found');
  return workspace;
}

async function saveWebhooks(workspace, webhooks) {
  const theme = { ...(workspace.theme || {}), webhooks };
  return workspace.update({ theme });
}

// List webhooks
router.get('/', authorize('owner', 'admin'), asyncHandler(async (req, res) => {
  const workspace = await getWorkspace(req.membership.workspaceId);
  res.json(success(getWebhooks(workspace)));
}));

// Create webhook
router.post('/', authorize('owner', 'admin'), asyncHandler(async (req, res) => {
  const { url, events, isActive } = req.body;
  if (!url || typeof url !== 'string') {
    throw new BadRequestError('Webhook URL is required');
  }
  if (!url.startsWith('https://')) {
    throw new BadRequestError('Webhook URL must use HTTPS');
  }

  const workspace = await getWorkspace(req.membership.workspaceId);
  const webhooks = getWebhooks(workspace);

  const webhook = {
    id: crypto.randomUUID(),
    url,
    events: Array.isArray(events) ? events : ['feedback.created'],
    isActive: isActive !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  webhooks.push(webhook);
  await saveWebhooks(workspace, webhooks);
  res.status(201).json(success(webhook));
}));

// Update webhook
router.patch('/:id', authorize('owner', 'admin'), asyncHandler(async (req, res) => {
  const workspace = await getWorkspace(req.membership.workspaceId);
  const webhooks = getWebhooks(workspace);
  const index = webhooks.findIndex((w) => w.id === req.params.id);
  if (index === -1) throw new NotFoundError('Webhook not found');

  const existing = webhooks[index];
  if (req.body.url !== undefined) existing.url = req.body.url;
  if (req.body.events !== undefined) existing.events = req.body.events;
  if (req.body.isActive !== undefined) existing.isActive = req.body.isActive;
  existing.updatedAt = new Date().toISOString();

  await saveWebhooks(workspace, webhooks);
  res.json(success(existing));
}));

// Delete webhook
router.delete('/:id', authorize('owner', 'admin'), asyncHandler(async (req, res) => {
  const workspace = await getWorkspace(req.membership.workspaceId);
  const webhooks = getWebhooks(workspace);
  const index = webhooks.findIndex((w) => w.id === req.params.id);
  if (index === -1) throw new NotFoundError('Webhook not found');

  webhooks.splice(index, 1);
  await saveWebhooks(workspace, webhooks);
  res.json(success({ deleted: true }));
}));

export { router as webhookRoutes };
