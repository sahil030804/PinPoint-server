import { asyncHandler } from '../utils/asyncHandler.js';
import { WorkspaceMember, Feedback, Website, Project } from '../../database/models/index.js';
import { BadRequestError, NotFoundError, AuthorizationError } from '../errors/AppError.js';

async function checkMembership(userId, workspaceId, req) {
  if (!workspaceId) return null;
  const cacheKey = `membership:${userId}:${workspaceId}`;
  if (req._membershipCache?.has(cacheKey)) {
    return req._membershipCache.get(cacheKey);
  }
  const membership = await WorkspaceMember.findOne({ where: { userId, workspaceId } });
  if (!req._membershipCache) req._membershipCache = new Map();
  req._membershipCache.set(cacheKey, membership);
  return membership;
}

export const requireWorkspaceAccess = asyncHandler(async (req, _res, next) => {
  const workspaceId = req.params.workspaceId || req.params.id;
  if (!workspaceId) throw new BadRequestError('Workspace ID required');

  const membership = await checkMembership(req.user.id, workspaceId, req);
  if (!membership) throw new AuthorizationError('Not a member of this workspace');

  req.membership = membership;
  next();
});

export const requireProjectAccess = asyncHandler(async (req, _res, next) => {
  const projectId = req.params.projectId || req.params.id;
  if (!projectId) throw new BadRequestError('Project ID required');

  const project = await Project.findByPk(projectId, { attributes: ['workspaceId'] });
  if (!project) throw new NotFoundError('Project not found');

  const membership = await checkMembership(req.user.id, project.workspaceId, req);
  if (!membership) throw new AuthorizationError('Not a member of this workspace');

  req.membership = membership;
  next();
});

export const requireWebsiteAccess = asyncHandler(async (req, _res, next) => {
  const websiteId = req.params.websiteId || req.params.id;
  if (!websiteId) throw new BadRequestError('Website ID required');

  const website = await Website.findByPk(websiteId, {
    attributes: ['projectId'],
    include: [{ model: Project, attributes: ['workspaceId'] }],
  });
  if (!website) throw new NotFoundError('Website not found');

  const workspaceId = website.Project?.workspaceId;
  if (!workspaceId) throw new AuthorizationError('Website has no associated workspace');

  const membership = await checkMembership(req.user.id, workspaceId, req);
  if (!membership) throw new AuthorizationError('Not a member of this workspace');

  req.membership = membership;
  next();
});

export const requireFeedbackAccess = asyncHandler(async (req, _res, next) => {
  const feedbackId = req.params.feedbackId || req.params.id;
  if (!feedbackId) throw new BadRequestError('Feedback ID required');

  const feedback = await Feedback.findByPk(feedbackId, {
    attributes: ['websiteId'],
    include: [{
      model: Website,
      attributes: ['projectId'],
      include: [{ model: Project, attributes: ['workspaceId'] }],
    }],
  });
  if (!feedback) throw new NotFoundError('Feedback not found');

  const workspaceId = feedback.Website?.Project?.workspaceId;
  if (!workspaceId) throw new AuthorizationError('Feedback has no associated workspace');

  const membership = await checkMembership(req.user.id, workspaceId, req);
  if (!membership) throw new AuthorizationError('Not a member of this workspace');

  req.membership = membership;
  next();
});
