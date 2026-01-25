/**
 * BullMQ Queue Setup and Job Definitions
 */

import { Queue, Worker, Job, QueueEvents, ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('queue');

// ============================================
// Queue Names
// ============================================

export const QUEUE_NAMES = {
  // Ingestion
  TOKEN_DISCOVERED: 'token:discovered',
  POOL_DISCOVERED: 'pool:discovered',
  TRADE_DETECTED: 'trade:detected',
  PUMPFUN_EVENT: 'pumpfun:event',

  // Analysis
  ANALYZE_TOKEN: 'analyze:token',
  ANALYZE_SAFETY: 'analyze:safety',
  ANALYZE_MOMENTUM: 'analyze:momentum',
  ANALYZE_SOCIAL: 'analyze:social',
  CROSS_VERIFY: 'cross:verify',
  CALCULATE_SCORE: 'calculate:score',

  // Notifications
  SEND_ALERT: 'send:alert',

  // Periodic jobs
  POLL_MARKET_DATA: 'poll:market-data',
  POLL_HOLDERS: 'poll:holders',
  POLL_SOCIAL: 'poll:social',
  CLEANUP: 'cleanup',
} as const;

// ============================================
// Job Types
// ============================================

export interface TokenDiscoveredJob {
  mintAddress: string;
  discoverySource: string;
  signature?: string;
  timestamp: Date;
  metadata?: {
    name?: string;
    symbol?: string;
    creatorWallet?: string;
  };
}

export interface PoolDiscoveredJob {
  poolAddress: string;
  dex: string;
  tokenMint: string;
  quoteMint: string;
  signature: string;
  timestamp: Date;
  initialLiquidity?: {
    tokenReserve: string;
    quoteReserve: string;
  };
}

export interface TradeDetectedJob {
  signature: string;
  poolAddress: string;
  tokenMint: string;
  side: 'BUY' | 'SELL';
  tokenAmount: string;
  quoteAmount: string;
  traderWallet: string;
  timestamp: Date;
}

export interface PumpfunEventJob {
  type: 'CREATE' | 'BUY' | 'SELL' | 'GRADUATE';
  signature: string;
  mintAddress: string;
  bondingCurveAddress: string;
  timestamp: Date;
  tokenAmount?: string;
  solAmount?: string;
  traderWallet?: string;
  raydiumPoolAddress?: string;
}

export interface AnalyzeTokenJob {
  mintAddress: string;
  priority?: 'HIGH' | 'NORMAL' | 'LOW';
  source?: string;
}

export interface SendAlertJob {
  alertId: string;
  type: string;
  tokenMint: string;
}

export interface PollMarketDataJob {
  mintAddresses: string[];
}

// ============================================
// Queue Manager
// ============================================

export class QueueManager {
  private connection: ConnectionOptions;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private events: Map<string, QueueEvents> = new Map();

  constructor(redisUrl?: string) {
    const url = redisUrl || process.env.REDIS_URL || 'redis://localhost:6379';
    this.connection = { url };
  }

  getQueue<T>(name: string): Queue<T> {
    if (!this.queues.has(name)) {
      const queue = new Queue<T>(name, {
        connection: this.connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: {
            age: 3600, // 1 hour
            count: 1000,
          },
          removeOnFail: {
            age: 86400, // 24 hours
          },
        },
      });
      this.queues.set(name, queue);
    }
    return this.queues.get(name)! as Queue<T>;
  }

  createWorker<T, R>(
    queueName: string,
    processor: (job: Job<T>) => Promise<R>,
    options?: {
      concurrency?: number;
      limiter?: {
        max: number;
        duration: number;
      };
    }
  ): Worker<T, R> {
    const worker = new Worker<T, R>(queueName, processor, {
      connection: this.connection,
      concurrency: options?.concurrency || 5,
      limiter: options?.limiter,
    });

    worker.on('completed', (job) => {
      logger.debug({ jobId: job.id, queue: queueName }, 'Job completed');
    });

    worker.on('failed', (job, err) => {
      logger.error(
        { jobId: job?.id, queue: queueName, error: err.message },
        'Job failed'
      );
    });

    worker.on('error', (err) => {
      logger.error({ queue: queueName, error: err.message }, 'Worker error');
    });

    this.workers.set(queueName, worker);
    return worker;
  }

  getQueueEvents(queueName: string): QueueEvents {
    if (!this.events.has(queueName)) {
      const events = new QueueEvents(queueName, {
        connection: this.connection,
      });
      this.events.set(queueName, events);
    }
    return this.events.get(queueName)!;
  }

  async addJob<T>(
    queueName: string,
    data: T,
    options?: {
      priority?: number;
      delay?: number;
      jobId?: string;
      repeat?: {
        pattern?: string;
        every?: number;
        limit?: number;
      };
    }
  ): Promise<Job<T>> {
    const queue = this.getQueue<T>(queueName);
    return queue.add(queueName, data, {
      priority: options?.priority,
      delay: options?.delay,
      jobId: options?.jobId,
      repeat: options?.repeat,
    });
  }

  async addBulk<T>(
    queueName: string,
    jobs: Array<{ data: T; options?: { priority?: number; delay?: number } }>
  ): Promise<Job<T>[]> {
    const queue = this.getQueue<T>(queueName);
    return queue.addBulk(
      jobs.map((j) => ({
        name: queueName,
        data: j.data,
        opts: j.options,
      }))
    );
  }

  async getQueueStats(queueName: string) {
    const queue = this.getQueue(queueName);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  async getAllQueueStats() {
    const stats: Record<string, Awaited<ReturnType<typeof this.getQueueStats>>> = {};

    for (const name of Object.values(QUEUE_NAMES)) {
      if (this.queues.has(name)) {
        stats[name] = await this.getQueueStats(name);
      }
    }

    return stats;
  }

  async close(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const worker of this.workers.values()) {
      closePromises.push(worker.close());
    }

    for (const queue of this.queues.values()) {
      closePromises.push(queue.close());
    }

    for (const events of this.events.values()) {
      closePromises.push(events.close());
    }

    await Promise.all(closePromises);
    logger.info('All queues and workers closed');
  }
}

// Singleton instance
let queueManager: QueueManager | null = null;

export function getQueueManager(): QueueManager {
  if (!queueManager) {
    queueManager = new QueueManager();
  }
  return queueManager;
}

export function closeQueueManager(): Promise<void> {
  if (queueManager) {
    const manager = queueManager;
    queueManager = null;
    return manager.close();
  }
  return Promise.resolve();
}
