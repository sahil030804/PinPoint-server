import { env } from './env.js';

const allowedOrigins = [
  env.auth.appUrl,
  'http://localhost:3000',
  'http://localhost:4000',
];

if (env.r2.publicUrl) {
  allowedOrigins.push(env.r2.publicUrl);
}

export const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Don't error — widget routes set their own CORS headers before this runs
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
};
