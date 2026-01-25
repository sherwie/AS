/**
 * Redis-backed cache with in-memory fallback
 */

import { Redis } from 'ioredis';
import { createLogger } from './logger.js';

const logger = createLogger('cache');

export interface CacheConfig {
  redis?: Redis;
  defaultTtlSeconds?: number;
  keyPrefix?: string;
}

export class Cache {
  private redis: Redis | null;
  private memory: Map<string, { value: unknown; expiry: number }>;
  private defaultTtl: number;
  private keyPrefix: string;

  constructor(config: CacheConfig = {}) {
    this.redis = config.redis || null;
    this.memory = new Map();
    this.defaultTtl = config.defaultTtlSeconds || 300;
    this.keyPrefix = config.keyPrefix || 'cache:';

    // Cleanup expired entries periodically
    if (!this.redis) {
      setInterval(() => this.cleanupMemory(), 60000);
    }
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.getKey(key);

    if (this.redis) {
      try {
        const value = await this.redis.get(fullKey);
        if (value) {
          return JSON.parse(value) as T;
        }
      } catch (error) {
        logger.warn({ error, key }, 'Redis cache get failed, falling back to memory');
      }
    }

    // Memory fallback
    const entry = this.memory.get(fullKey);
    if (entry && entry.expiry > Date.now()) {
      return entry.value as T;
    }
    return null;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const fullKey = this.getKey(key);
    const ttl = ttlSeconds || this.defaultTtl;

    if (this.redis) {
      try {
        await this.redis.setex(fullKey, ttl, JSON.stringify(value));
        return;
      } catch (error) {
        logger.warn({ error, key }, 'Redis cache set failed, falling back to memory');
      }
    }

    // Memory fallback
    this.memory.set(fullKey, {
      value,
      expiry: Date.now() + ttl * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    const fullKey = this.getKey(key);

    if (this.redis) {
      try {
        await this.redis.del(fullKey);
      } catch (error) {
        logger.warn({ error, key }, 'Redis cache delete failed');
      }
    }

    this.memory.delete(fullKey);
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (this.redis && keys.length > 0) {
      try {
        const fullKeys = keys.map(k => this.getKey(k));
        const values = await this.redis.mget(fullKeys);
        return values.map(v => (v ? (JSON.parse(v) as T) : null));
      } catch (error) {
        logger.warn({ error }, 'Redis cache mget failed');
      }
    }

    return Promise.all(keys.map(k => this.get<T>(k)));
  }

  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    if (this.redis && entries.length > 0) {
      try {
        const pipeline = this.redis.pipeline();
        for (const { key, value, ttl } of entries) {
          const fullKey = this.getKey(key);
          pipeline.setex(fullKey, ttl || this.defaultTtl, JSON.stringify(value));
        }
        await pipeline.exec();
        return;
      } catch (error) {
        logger.warn({ error }, 'Redis cache mset failed');
      }
    }

    await Promise.all(entries.map(e => this.set(e.key, e.value, e.ttl)));
  }

  private cleanupMemory(): void {
    const now = Date.now();
    for (const [key, entry] of this.memory.entries()) {
      if (entry.expiry <= now) {
        this.memory.delete(key);
      }
    }
  }

  // Specialized cache namespaces
  token(mintAddress: string) {
    return {
      info: `token:${mintAddress}:info`,
      metadata: `token:${mintAddress}:metadata`,
      price: `token:${mintAddress}:price`,
      holders: `token:${mintAddress}:holders`,
      safety: `token:${mintAddress}:safety`,
      momentum: `token:${mintAddress}:momentum`,
      score: `token:${mintAddress}:score`,
    };
  }

  pool(poolAddress: string) {
    return {
      info: `pool:${poolAddress}:info`,
      trades: `pool:${poolAddress}:trades`,
    };
  }
}

// Cache TTLs for different data types (in seconds)
export const CACHE_TTL = {
  TOKEN_INFO: 3600, // 1 hour
  TOKEN_METADATA: 86400, // 24 hours
  PRICE: 30, // 30 seconds
  PRICE_HISTORY: 60, // 1 minute
  VOLUME: 60, // 1 minute
  HOLDERS: 300, // 5 minutes
  SAFETY_ANALYSIS: 300, // 5 minutes
  MOMENTUM: 60, // 1 minute
  SCORE: 120, // 2 minutes
  POOL_INFO: 300, // 5 minutes
  DEX_NEW_PAIRS: 60, // 1 minute
  JUPITER_QUOTE: 10, // 10 seconds
  SOCIAL_MENTIONS: 120, // 2 minutes
};
