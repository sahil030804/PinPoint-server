import redis from '../../config/redis.js';

export class CacheService {
  constructor() {
    this.client = redis;
    this.DEFAULT_TTL = 300; // 5 minutes
  }

  async get(key) {
    const cached = await this.client.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async set(key, value, ttl = this.DEFAULT_TTL) {
    await this.client.set(key, JSON.stringify(value), 'EX', ttl);
  }

  async invalidate(pattern) {
    const stream = this.client.scanStream({ match: `${pattern}:*`, count: 100 });
    for await (const keys of stream) {
      if (keys.length) {
        await this.client.del(keys);
      }
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
