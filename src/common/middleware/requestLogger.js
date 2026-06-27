import pino from 'pino';

const logger = pino({
  name: 'pinpoint-api',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
  redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password'],
});

export function requestLogger(req, _res, next) {
  const start = Date.now();

  _res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: _res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user?.id,
      authType: req.authType,
    });
  });

  next();
}

export { logger };
