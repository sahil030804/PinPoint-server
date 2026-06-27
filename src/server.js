import http from 'http';
import { app } from './app.js';
import { env } from './config/env.js';
import { sequelize } from './database/models/index.js';
import redis from './config/redis.js';
import { logger } from './common/middleware/requestLogger.js';
import { Server as SocketIOServer } from 'socket.io';

const server = http.createServer(app);

// ─── Socket.io ───
const io = new SocketIOServer(server, {
  cors: {
    origin: env.auth.appUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  logger.info(`[Socket.io] Client connected: ${socket.id}`);

  socket.on('join:feedback', (feedbackId) => {
    socket.join(`feedback:${feedbackId}`);
  });

  socket.on('leave:feedback', (feedbackId) => {
    socket.leave(`feedback:${feedbackId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Make io accessible to routes
app.set('io', io);

// ─── Database Connection ───
async function startServer() {
  try {
    await sequelize.authenticate();
    logger.info('[Database] PostgreSQL connected');

    // Sync models in development (creates tables if they don't exist)
    if (env.isDev) {
      await sequelize.sync({ alter: false });
      logger.info('[Database] Models synchronized');
    }

    server.listen(env.port, () => {
      logger.info(`[Server] PinPoint API running on port ${env.port}`);
      logger.info(`[Server] Environment: ${env.nodeEnv}`);
      logger.info(`[Server] Health check: http://localhost:${env.port}/health`);
    });
  } catch (err) {
    logger.error({ err }, '[Server] Failed to start');
    process.exit(1);
  }
}

// ─── Graceful Shutdown ───
function shutdown(signal) {
  logger.info(`[Server] Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    await sequelize.close();
    redis.disconnect();
    logger.info('[Server] All connections closed. Goodbye.');
    process.exit(0);
  });

  // Force shutdown after 10s
  setTimeout(() => {
    logger.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();
