import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { corsOptions } from './config/cors.js';
import { requestLogger } from './common/middleware/requestLogger.js';
import { errorHandler } from './common/errors/errorHandler.js';
import { createRateLimiter } from './common/middleware/rateLimiter.js';
import { logger } from './common/middleware/requestLogger.js';

// Route imports
import { authRoutes } from './modules/auth/auth.routes.js';
import { workspaceRoutes } from './modules/workspace/workspace.routes.js';
import { projectRoutes } from './modules/project/project.routes.js';
import { websiteRoutes } from './modules/website/website.routes.js';
import { feedbackRoutes } from './modules/feedback/feedback.routes.js';
import { timelineRoutes } from './modules/timeline/timeline.routes.js';
import { commentRoutes } from './modules/comment/comment.routes.js';
import { notificationRoutes } from './modules/notification/notification.routes.js';
import { analyticsRoutes } from './modules/analytics/analytics.routes.js';
import { apiKeyRoutes } from './modules/api-key/api-key.routes.js';
import { webhookRoutes } from './modules/webhook/webhook.routes.js';

const app = express();

app.set('trust proxy', 1);

// ─── Widget CORS (permissive — called from customer websites) ───
// Must run before global CORS to handle preflight and set headers
app.use('/v1/widget', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use('/v1/feedback/widget', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── Global Middleware ───
app.use(compression({ level: 6, threshold: 256 }));
app.use(helmet());
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(createRateLimiter());

// ─── Health Check (enhanced with DB + Redis checks) ───
app.get('/health', async (_req, res) => {
  let dbOk = false;
  let redisOk = false;
  try {
    await import('./config/database.js').then(m => m.sequelize.authenticate());
    dbOk = true;
  } catch {}
  try {
    const redis = await import('./config/redis.js').then(m => m.default || m.redis);
    await redis.ping();
    redisOk = true;
  } catch {}
  res.json({ status: dbOk && redisOk ? 'ok' : 'degraded', db: dbOk ? 'connected' : 'error', redis: redisOk ? 'connected' : 'error', timestamp: new Date().toISOString() });
});

// ─── API Routes ───
app.use('/v1/auth', authRoutes);
app.use('/v1/workspaces', workspaceRoutes);
app.use('/v1/projects', projectRoutes);
app.use('/v1/websites', websiteRoutes);
app.use('/v1/feedback', feedbackRoutes);
app.use('/v1/timeline', timelineRoutes);
app.use('/v1/comments', commentRoutes);
app.use('/v1/notifications', notificationRoutes);
app.use('/v1/analytics', analyticsRoutes);
app.use('/v1/api-keys', apiKeyRoutes);
app.use('/v1/webhooks', webhookRoutes);

// ─── Widget Routes ───
// Note: widget endpoints are defined inside feedbackRoutes at /v1/feedback/widget/:projectId/feedback
// Also exposed at /v1/widget/:projectId/feedback via a redirect
app.post('/v1/widget/:projectId/feedback', (req, res, next) => {
  req.params.projectId = req.params.projectId;
  next();
}, (req, res) => {
  // Forward to feedback widget handler
  res.redirect(307, `/v1/feedback/widget/${req.params.projectId}/feedback`);
});

// ─── 404 Handler ───
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

// ─── Error Handler ───
app.use(errorHandler);

export { app };
export default app;
