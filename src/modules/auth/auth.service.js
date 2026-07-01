import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { env } from '../../config/env.js';
import { User, Workspace, WorkspaceMember, Invitation } from '../../database/models/index.js';
import { ConflictError, AuthenticationError, BadRequestError } from '../../common/errors/AppError.js';
import { slugify } from '../../common/utils/slugify.js';

export class AuthService {
  async register({ email, password, name, invitationId }) {
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

    let workspaceId = null;
    let role = null;

    if (invitationId) {
      const invitation = await Invitation.findByPk(invitationId);
      if (invitation && invitation.email === email && invitation.status === 'pending') {
        await WorkspaceMember.create({
          workspaceId: invitation.workspaceId,
          userId: user.id,
          role: invitation.role,
        });
        await invitation.update({ status: 'accepted', acceptedAt: new Date() });
        workspaceId = invitation.workspaceId;
        role = invitation.role;
      }
    }

    const token = this.generateToken(user, workspaceId);

    return { user: this.sanitizeUser(user, workspaceId, role), token };
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

  async updateProfile(userId, { name, avatarUrl }) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

    await user.update(updates);

    const membership = await WorkspaceMember.findOne({
      where: { userId: user.id },
    });

    return this.sanitizeUser(user, membership?.workspaceId, membership?.role);
  }

  async invalidateSessions(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    await user.increment('tokenVersion', { by: 1 });
  }

  async forgotPassword({ email }) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return { ok: true };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const hash = await bcrypt.hash(token, 10);

    await user.update({
      resetTokenHash: hash,
      resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    return { ok: true, resetToken: token, email: user.email };
  }

  async resetPassword({ token, password }) {
    const users = await User.findAll({
      where: {
        resetTokenHash: { [Op.ne]: null },
        resetTokenExpiresAt: { [Op.gte]: new Date() },
      },
    });

    let matchedUser = null;
    for (const u of users) {
      const valid = await bcrypt.compare(token, u.resetTokenHash);
      if (valid) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await matchedUser.update({
      passwordHash,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
      tokenVersion: matchedUser.tokenVersion + 1,
    });

    const membership = await WorkspaceMember.findOne({
      where: { userId: matchedUser.id },
    });

    const jwtToken = this.generateToken(matchedUser, membership?.workspaceId);

    return {
      user: this.sanitizeUser(matchedUser, membership?.workspaceId, membership?.role),
      token: jwtToken,
    };
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
