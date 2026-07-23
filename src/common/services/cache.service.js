import redis from '../../config/redis.js';

const cacheLogger = {
  warn: (msg, data) => console.warn(`[CacheService] ${msg}`, JSON.stringify(data)),
};

export class CacheService {
  constructor() {
    this.client = redis;
    this.DEFAULT_TTL = 300;
  }

  async get(key) {
    try {
      const cached = await this.client.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      cacheLogger.warn('Cache get failed', { err: err.message, key });
      return null;
    }
  }

  async set(key, value, ttl = this.DEFAULT_TTL) {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (err) {
      cacheLogger.warn('Cache set failed', { err: err.message, key });
    }
  }

  async invalidate(pattern) {
    try {
      const stream = this.client.scanStream({ match: `${pattern}:*`, count: 100 });
      for await (const keys of stream) {
        if (keys.length) {
          await this.client.del(keys);
        }
      }
    } catch (err) {
      cacheLogger.warn('Cache invalidate failed', { err: err.message, pattern });
    }
  }

  async getOrSet(key, fetcher, ttl) {
    const cached = await this.get(key);
    if (cached !== null) return cached;
    const data = await fetcher();
    await this.set(key, data, ttl);
    return data;
  }
}

export const cacheService = new CacheService();
