import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(255),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(255),
});

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').optional(),
});

export const addWebsiteSchema = z.object({
  url: z.string().url('Invalid URL'),
  widgetConfig: z.object({
    position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    buttonText: z.string().max(50).optional(),
    icon: z.enum(['chat', 'bug', 'feedback']).optional(),
    darkMode: z.boolean().optional(),
  }).optional(),
});

export const createFeedbackSchema = z.object({
  comment: z.string().min(1, 'Comment is required'),
  title: z.string().max(500).optional(),
  pageUrl: z.string(),
  coordinates: z.object({
    x: z.number(),
    y: z.number(),
    element: z.string().optional(),
  }),
  screenshot: z.union([
    z.string(),
    z.object({ clientUrl: z.string().optional(), serverUrl: z.string().optional() }),
  ]).optional(),
  annotations: z.array(z.object({
    id: z.string(),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
    color: z.string(),
    label: z.string().optional(),
  })).optional(),
  metadata: z.object({
    browser: z.string().optional(),
    os: z.string().optional(),
    screenResolution: z.string().optional(),
    viewport: z.string().optional(),
    timestamp: z.string().optional(),
    timezone: z.string().optional(),
    language: z.string().optional(),
    deviceType: z.string().optional(),
    referrer: z.string().optional(),
    userAgent: z.string().optional(),
    cookiesEnabled: z.boolean().optional(),
    darkMode: z.boolean().optional(),
  }),
  reporterEmail: z.string().email().optional(),
  reporterName: z.string().max(255).optional(),
});

export const updateFeedbackSchema = z.object({
  status: z.enum(['new', 'open', 'in_progress', 'testing', 'done', 'closed']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
  annotations: z.array(z.object({
    id: z.string(),
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
    color: z.string(),
    label: z.string().optional(),
  })).optional(),
});

export const addCommentSchema = z.object({
  body: z.string().min(1, 'Comment body is required'),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'developer', 'viewer', 'client']).optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255).optional(),
  avatarUrl: z.string().url('Invalid URL').nullable().optional(),
});

export const updateMemberSchema = z.object({
  role: z.enum(['admin', 'developer', 'viewer', 'client']),
});

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(255).optional(),
  logoUrl: z.string().url('Invalid URL').nullable().optional(),
  theme: z.object({}).passthrough().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255).optional(),
  description: z.string().nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').optional(),
});

export const updateWebsiteSchema = z.object({
  url: z.string().url('Invalid URL').optional(),
  isActive: z.boolean().optional(),
  widgetConfig: z.object({
    position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    buttonText: z.string().max(50).optional(),
    icon: z.enum(['chat', 'bug', 'feedback']).optional(),
    darkMode: z.boolean().optional(),
  }).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
