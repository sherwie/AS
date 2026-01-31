/**
 * Token bucket rate limiter with Redis support
 */

import { Redis } from 'ioredis';
import { createLogger } from './logger.js';

const logger = createLogger('rate-limiter');

export interface RateLimiterConfig {
  name: string;
  maxTokens: number; // Max requests per window
  refillRate: number; // Tokens refilled per second
  redis?: Redis;
}

export class RateLimiter {
  private name: string;
  private maxTokens: number;
  private refillRate: number;
  private redis: Redis | null;

  // In-memory fallback
  private tokens: number;
  private lastRefill: number;

  constructor(config: RateLimiterConfig) {
    this.name = config.name;
    this.maxTokens = config.maxTokens;
    this.refillRate = config.refillRate;
    this.redis = config.redis || null;
    this.tokens = config.maxTokens;
    this.lastRefill = Date.now();
  }

  private refillTokens(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const refill = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + refill);
    this.lastRefill = now;
  }

  async acquire(tokens: number = 1): Promise<boolean> {
    if (this.redis) {
      return this.acquireRedis(tokens);
    }
    return this.acquireLocal(tokens);
  }

  private acquireLocal(tokens: number): boolean {
    this.refillTokens();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }

    return false;
  }

  private async acquireRedis(tokens: number): Promise<boolean> {
    const key = `ratelimit:${this.name}`;
    const now = Date.now();

    const script = `
      local key = KEYS[1]
      local maxTokens = tonumber(ARGV[1])
      local refillRate = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      local requested = tonumber(ARGV[4])

      local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
      local currentTokens = tonumber(bucket[1]) or maxTokens
      local lastRefill = tonumber(bucket[2]) or now

      local elapsed = (now - lastRefill) / 1000
      local refill = elapsed * refillRate
      currentTokens = math.min(maxTokens, currentTokens + refill)

      if currentTokens >= requested then
        currentTokens = currentTokens - requested
        redis.call('HMSET', key, 'tokens', currentTokens, 'lastRefill', now)
        redis.call('EXPIRE', key, 60)
        return 1
      else
        redis.call('HMSET', key, 'tokens', currentTokens, 'lastRefill', now)
        redis.call('EXPIRE', key, 60)
        return 0
      end
    `;

    try {
      const result = await this.redis!.eval(
        script,
        1,
        key,
        this.maxTokens,
        this.refillRate,
        now,
        tokens
      );
      return result === 1;
    } catch (error) {
      logger.warn({ error, name: this.name }, 'Redis rate limit failed, falling back to local');
      return this.acquireLocal(tokens);
    }
  }

  async waitForToken(tokens: number = 1, maxWaitMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      if (await this.acquire(tokens)) {
        return true;
      }
      // Wait before retry (exponential backoff with jitter)
      const waitTime = Math.min(100 + Math.random() * 100, maxWaitMs - (Date.now() - startTime));
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    return false;
  }

  getAvailableTokens(): number {
    this.refillTokens();
    return this.tokens;
  }
}

// Create rate limiters for each provider
export function createProviderRateLimiters(redis?: Redis) {
  return {
    rpc: new RateLimiter({
      name: 'rpc',
      maxTokens: Number(process.env.RPC_RATE_LIMIT) || 100,
      refillRate: (Number(process.env.RPC_RATE_LIMIT) || 100) / 60,
      redis,
    }),
    dexscreener: new RateLimiter({
      name: 'dexscreener',
      maxTokens: Number(process.env.DEXSCREENER_RATE_LIMIT) || 30,
      refillRate: (Number(process.env.DEXSCREENER_RATE_LIMIT) || 30) / 60,
      redis,
    }),
    geckoterminal: new RateLimiter({
      name: 'geckoterminal',
      maxTokens: Number(process.env.GECKOTERMINAL_RATE_LIMIT) || 30,
      refillRate: (Number(process.env.GECKOTERMINAL_RATE_LIMIT) || 30) / 60,
      redis,
    }),
    jupiter: new RateLimiter({
      name: 'jupiter',
      maxTokens: Number(process.env.JUPITER_RATE_LIMIT) || 60,
      refillRate: (Number(process.env.JUPITER_RATE_LIMIT) || 60) / 60,
      redis,
    }),
    birdeye: new RateLimiter({
      name: 'birdeye',
      maxTokens: 30,
      refillRate: 0.5,
      redis,
    }),
  };
}
