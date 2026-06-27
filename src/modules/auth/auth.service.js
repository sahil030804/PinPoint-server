import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { User, Workspace, WorkspaceMember } from '../../database/models/index.js';
import { ConflictError, AuthenticationError, BadRequestError } from '../../common/errors/AppError.js';
import { slugify } from '../../common/utils/slugify.js';

export class AuthService {
  async register({ email, password, name }) {
    const existing = await User.findOne({ where: { email } });
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      email,
      name,
      passwordHash,
    });

    const token = this.generateToken(user, null);

    return { user: this.sanitizeUser(user), token };
  }

  async login({ email, password }) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestError('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new BadRequestError('Invalid email or password');
    }

    const membership = await WorkspaceMember.findOne({
      where: { userId: user.id },
    });

    const token = this.generateToken(user, membership?.workspaceId);

    return { user: this.sanitizeUser(user, membership?.workspaceId, membership?.role), token };
  }

  async refresh(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }
      
    const membership = await WorkspaceMember.findOne({
      where: { userId: user.id },
    });

    const token = this.generateToken(user, membership?.workspaceId);

    return { user: this.sanitizeUser(user, membership?.workspaceId, membership?.role), token };
  }

  async invalidateSessions(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    await user.increment('tokenVersion', { by: 1 });
  }

  generateToken(user, workspaceId) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        workspaceId,
        tokenVersion: user.tokenVersion ?? 0,
      },
      env.auth.secret,
      { expiresIn: '7d' }
    );
  }

  sanitizeUser(user, workspaceId = null, role = null) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      workspaceId,
      role,
    };
  }
}

export const authService = new AuthService();
