import { Redis } from 'ioredis';
import { env } from './env.js';

const redis = new Redis(env.redis.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

redis.on('connect', () => {
  console.log('[Redis] Connected');
});

export { redis };
export default redis;
