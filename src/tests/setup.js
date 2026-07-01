import { vi } from 'vitest';

vi.mock('../database/models/index.js', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    name: 'Test User',
  };

  const mockNotification = {
    id: 'notif-1',
    userId: 'user-2',
    type: 'feedback.created',
    title: 'Test notification',
    body: 'Test body',
    link: '/dashboard/projects/proj-1/feedback/fb-1',
    isRead: false,
    createdAt: new Date(),
    update: vi.fn().mockResolvedValue(true),
  };

  const mockWorkspaceMember = {
    userId: 'user-2',
    workspaceId: 'ws-1',
    role: 'developer',
    User: mockUser,
  };

  return {
    sequelize: {
      transaction: vi.fn((cb) => cb({ transaction: true })),
    },
    Notification: {
      create: vi.fn().mockResolvedValue(mockNotification),
      findAll: vi.fn().mockResolvedValue([mockNotification]),
      findOne: vi.fn().mockResolvedValue(mockNotification),
      count: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue([1]),
    },
    User: {
      findByPk: vi.fn().mockResolvedValue(mockUser),
      findOne: vi.fn().mockResolvedValue(mockUser),
    },
    WorkspaceMember: {
      findAll: vi.fn().mockResolvedValue([
        { userId: 'user-2', workspaceId: 'ws-1', role: 'developer', User: mockUser },
        { userId: 'user-3', workspaceId: 'ws-1', role: 'viewer', User: { ...mockUser, id: 'user-3', name: 'Viewer' } },
      ]),
      findOne: vi.fn().mockResolvedValue(mockWorkspaceMember),
    },
    Workspace: {
      findByPk: vi.fn().mockResolvedValue({ id: 'ws-1', name: 'Test Workspace' }),
    },
    Project: {
      findByPk: vi.fn().mockResolvedValue({ id: 'proj-1', name: 'Test Project' }),
    },
    Website: {
      findByPk: vi.fn().mockResolvedValue({ id: 'web-1', url: 'https://example.com' }),
    },
    Feedback: {
      findByPk: vi.fn().mockResolvedValue({ id: 'fb-1', comment: 'Test feedback' }),
    },
    ActivityLog: {
      create: vi.fn().mockResolvedValue({ id: 'log-1', action: 'created' }),
      findOne: vi.fn().mockResolvedValue({ id: 'log-1', action: 'created' }),
    },
    Comment: {
      create: vi.fn().mockResolvedValue({ id: 'comment-1', body: 'Test comment' }),
    },
    ApiKey: {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'key-1' }),
    },
  };
});

vi.mock('../middleware/requestLogger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
