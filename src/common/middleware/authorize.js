import { AuthorizationError } from '../errors/AppError.js';

const ROLE_HIERARCHY = {
  owner: 5,
  admin: 4,
  developer: 3,
  viewer: 2,
  client: 1,
};

export function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (req.authType === 'api_key') {
      return next();
    }

    if (!req.membership) {
      throw new AuthorizationError('Workspace membership context required');
    }

    const userRole = req.membership.role || 'viewer';
    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    const requiredLevel = Math.min(...allowedRoles.map((r) => ROLE_HIERARCHY[r] || 0));

    if (userLevel < requiredLevel) {
      const roleNames = allowedRoles
        .map((r) => `${r} (level ${ROLE_HIERARCHY[r]})`)
        .join(', ');
      throw new AuthorizationError(`Requires one of: ${roleNames}`);
    }

    next();
  };
}
