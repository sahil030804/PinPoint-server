import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { AuthenticationError } from '../errors/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User, ApiKey, WorkspaceMember } from '../../database/models/index.js';

async function verifyJwt(token, ignoreExpiration = false) {
  const decoded = jwt.verify(token, env.auth.secret, ignoreExpiration ? { ignoreExpiration: true } : {});

  const user = await User.findByPk(decoded.id, { attributes: ['id', 'tokenVersion'] });

  if (!user || user.tokenVersion !== (decoded.tokenVersion ?? -1)) {
    throw new AuthenticationError('Token has been invalidated. Please log in again.');
  }

  return decoded;
}

async function verifyApiKey(token) {
  const keyPrefix = token.length > 16 ? token.slice(0, 16) : token;

  const apiKeyRecord = await ApiKey.findOne({ where: { keyPrefix } });
  if (!apiKeyRecord) return null;

  const valid = await bcrypt.compare(token, apiKeyRecord.keyHash);
  if (!valid) return null;

  if (apiKeyRecord.expiresAt && new Date(apiKeyRecord.expiresAt) < new Date()) {
    throw new AuthenticationError('API key has expired');
  }

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (!apiKeyRecord.lastUsedAt || apiKeyRecord.lastUsedAt < fiveMinutesAgo) {
    apiKeyRecord.lastUsedAt = new Date();
    await apiKeyRecord.save();
  }

  return {
    id: null,
    workspaceId: apiKeyRecord.workspaceId,
    apiKeyRole: apiKeyRecord.role || 'developer',
  };
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    if (token.startsWith('pp_')) {
      try {
        const user = await verifyApiKey(token);
        if (user) {
          req.user = user;
          req.authType = 'api_key';
          req.membership = { role: user.apiKeyRole, workspaceId: user.workspaceId };
          return next();
        }
      } catch (err) {
        if (err instanceof AuthenticationError) throw err;
      }

      throw new AuthenticationError('Invalid API key');
    }

    try {
      req.user = await verifyJwt(token);
      req.authType = 'jwt';
      return next();
    } catch (err) {
      if (err instanceof AuthenticationError) throw err;
    }
  }

  if (req.path.startsWith('/v1/widget/')) {
    return next();
  }

  throw new AuthenticationError();
});

export const authenticateRefresh = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    if (token.startsWith('pp_')) {
      throw new AuthenticationError('Cannot use API key for token refresh');
    }

    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) {
        throw new AuthenticationError('Invalid token');
      }
      const maxRefreshWindow = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() > decoded.exp * 1000 + maxRefreshWindow) {
        throw new AuthenticationError('Refresh window expired. Please log in again.');
      }
      req.user = await verifyJwt(token, true);
      req.authType = 'jwt';
      return next();
    } catch (err) {
      if (err instanceof AuthenticationError) throw err;
    }
  }

  throw new AuthenticationError('Invalid or expired token');
});
