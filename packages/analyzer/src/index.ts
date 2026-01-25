/**
 * Analyzer Service - Main Entry Point
 * Processes tokens through safety, momentum, and scoring engines
 */

import { Redis } from 'ioredis';
import express from 'express';
import { Connection } from '@solana/web3.js';
import {
  createLogger,
  loadEnv,
  getProviderConfig,
  printFeatureStatus,
  createProviderRateLimiters,
  createProviderCircuitBreakers,
  getQueueManager,
  closeQueueManager,
  QUEUE_NAMES,
  TokenDiscoveredJob,
  PoolDiscoveredJob,
  AnalyzeTokenJob,
  HealthChecker,
  createHealthHandler,
  getMetrics,
  getDb,
  closeDb,
  Cache,
  tokens,
  pools,
} from '@solana-signal/shared';
import { eq } from 'drizzle-orm';
import { RiskEngine } from './engines/risk-engine.js';
import { MomentumEngine } from './engines/momentum-engine.js';
import { ScoringEngine } from './engines/scoring-engine.js';
import { CrossVerificationEngine } from './engines/cross-verification.js';
import { SocialEngine } from './engines/social-engine.js';

const logger = createLogger('analyzer');

class AnalyzerService {
  private redis: Redis;
  private cache: Cache;
  private connection: Connection;

  // Engines
  private riskEngine: RiskEngine;
  private momentumEngine: MomentumEngine;
  private scoringEngine: ScoringEngine;
  private crossVerificationEngine: CrossVerificationEngine;
  private socialEngine: SocialEngine;

  private isRunning = false;

  constructor() {
    const env = loadEnv();
    const config = getProviderConfig();

    // Initialize Redis and cache
    this.redis = new Redis(env.REDIS_URL);
    this.cache = new Cache({ redis: this.redis });

    // Initialize Solana connection
    this.connection = new Connection(config.solanaRpcHttp, {
      commitment: 'confirmed',
    });

    // Initialize rate limiters and circuit breakers
    const rateLimiters = createProviderRateLimiters(this.redis);
    const circuitBreakers = createProviderCircuitBreakers();

    // Initialize engines
    this.riskEngine = new RiskEngine(this.connection, this.cache);
    this.momentumEngine = new MomentumEngine(this.cache);
    this.scoringEngine = new ScoringEngine(this.cache);
    this.crossVerificationEngine = new CrossVerificationEngine(this.cache);
    this.socialEngine = new SocialEngine(this.cache);

    logger.info('Analyzer service initialized');
  }

  async start(): Promise<void> {
    logger.info('Starting analyzer service...');
    printFeatureStatus();

    const queueManager = getQueueManager();

    // Create workers for analysis jobs
    queueManager.createWorker<TokenDiscoveredJob, void>(
      QUEUE_NAMES.TOKEN_DISCOVERED,
      async (job) => {
        await this.handleTokenDiscovered(job.data);
      },
      { concurrency: 5 }
    );

    queueManager.createWorker<PoolDiscoveredJob, void>(
      QUEUE_NAMES.POOL_DISCOVERED,
      async (job) => {
        await this.handlePoolDiscovered(job.data);
      },
      { concurrency: 5 }
    );

    queueManager.createWorker<AnalyzeTokenJob, void>(
      QUEUE_NAMES.ANALYZE_TOKEN,
      async (job) => {
        await this.analyzeToken(job.data.mintAddress);
      },
      { concurrency: 3 }
    );

    // Start periodic analysis jobs
    this.startPeriodicJobs();

    this.isRunning = true;
    logger.info('Analyzer service started successfully');
  }

  private async handleTokenDiscovered(data: TokenDiscoveredJob): Promise<void> {
    const { mintAddress, discoverySource, metadata } = data;

    logger.info({ mintAddress, discoverySource }, 'Processing discovered token');
    getMetrics().increment('tokens_discovered_total', 1, { source: discoverySource });

    const db = getDb();

    // Check if token already exists
    const existing = await db.select()
      .from(tokens)
      .where(eq(tokens.mintAddress, mintAddress));

    if (existing.length > 0) {
      logger.debug({ mintAddress }, 'Token already tracked');
      return;
    }

    // Insert new token
    await db.insert(tokens).values({
      mintAddress,
      name: metadata?.name || null,
      symbol: metadata?.symbol || null,
      discoveredAt: data.timestamp,
      discoverySource,
      creatorWallet: metadata?.creatorWallet || null,
      status: 'TRACKING',
      isPumpfun: discoverySource === 'PUMPFUN_CREATE',
    });

    // Queue for full analysis
    const queueManager = getQueueManager();
    await queueManager.addJob<AnalyzeTokenJob>(
      QUEUE_NAMES.ANALYZE_TOKEN,
      { mintAddress, priority: 'HIGH' },
      { priority: 1, delay: 5000 } // Small delay to let data settle
    );

    logger.info({ mintAddress, discoverySource }, 'Token added for tracking');
  }

  private async handlePoolDiscovered(data: PoolDiscoveredJob): Promise<void> {
    const { poolAddress, dex, tokenMint, quoteMint, initialLiquidity } = data;

    logger.info({ poolAddress, dex, tokenMint }, 'Processing discovered pool');
    getMetrics().increment('pools_discovered_total', 1, { dex });

    const db = getDb();

    // Check if pool already exists
    const existing = await db.select()
      .from(pools)
      .where(eq(pools.poolAddress, poolAddress));

    if (existing.length > 0) {
      logger.debug({ poolAddress }, 'Pool already tracked');
      return;
    }

    // Insert new pool
    await db.insert(pools).values({
      poolAddress,
      dex,
      tokenMint,
      quoteMint,
      tokenReserve: initialLiquidity?.tokenReserve ? BigInt(initialLiquidity.tokenReserve) : null,
      quoteReserve: initialLiquidity?.quoteReserve ? BigInt(initialLiquidity.quoteReserve) : null,
      createdAt: data.timestamp,
      isActive: true,
    });

    // Check if token is tracked, if not add it
    const tokenExists = await db.select()
      .from(tokens)
      .where(eq(tokens.mintAddress, tokenMint));

    if (tokenExists.length === 0) {
      await db.insert(tokens).values({
        mintAddress: tokenMint,
        discoveredAt: data.timestamp,
        discoverySource: `${dex}_POOL`,
        status: 'TRACKING',
      });
    }

    // Queue token for analysis
    const queueManager = getQueueManager();
    await queueManager.addJob<AnalyzeTokenJob>(
      QUEUE_NAMES.ANALYZE_TOKEN,
      { mintAddress: tokenMint, priority: 'HIGH' },
      { priority: 1, delay: 10000 }
    );

    logger.info({ poolAddress, dex, tokenMint }, 'Pool added for tracking');
  }

  private async analyzeToken(mintAddress: string): Promise<void> {
    const startTime = Date.now();
    logger.info({ mintAddress }, 'Starting full token analysis');

    try {
      // Run analysis in parallel where possible
      const [safetyAnalysis, crossVerification] = await Promise.all([
        this.riskEngine.analyze(mintAddress),
        this.crossVerificationEngine.verify(mintAddress),
      ]);

      // Momentum analysis (depends on trade data being available)
      const momentumAnalysis = await this.momentumEngine.analyze(mintAddress);

      // Social analysis (depends on connectors)
      const db = getDb();
      const token = await db.select()
        .from(tokens)
        .where(eq(tokens.mintAddress, mintAddress))
        .limit(1);

      const socialAnalysis = await this.socialEngine.analyze(
        mintAddress,
        token[0]?.symbol || undefined
      );

      // Calculate final scores
      const score = await this.scoringEngine.score(mintAddress);

      // Update token status based on score
      let newStatus = 'TRACKING';
      if (score.hardRejected) {
        newStatus = 'REJECTED';
      } else if (score.isCandidate) {
        newStatus = 'CANDIDATE';
      }

      await db.update(tokens)
        .set({ status: newStatus })
        .where(eq(tokens.mintAddress, mintAddress));

      // If candidate, queue for alert
      if (score.isCandidate && !score.hardRejected) {
        const queueManager = getQueueManager();
        await queueManager.addJob(QUEUE_NAMES.SEND_ALERT, {
          alertId: `${mintAddress}-${Date.now()}`,
          type: score.survivalScore >= 70 ? 'GENESIS_CANDIDATE' : 'IGNITION_BREAKOUT',
          tokenMint: mintAddress,
        });
      }

      const duration = Date.now() - startTime;
      getMetrics().histogram('analysis_duration_seconds', duration / 1000, { type: 'full' });

      logger.info({
        mintAddress,
        survivalScore: score.survivalScore,
        runnerScore: score.runnerScore,
        isCandidate: score.isCandidate,
        hardRejected: score.hardRejected,
        duration,
      }, 'Token analysis completed');
    } catch (error) {
      logger.error({ mintAddress, error }, 'Token analysis failed');
      getMetrics().increment('api_errors_total', 1, { type: 'analysis' });
    }
  }

  private startPeriodicJobs(): void {
    const queueManager = getQueueManager();

    // Re-analyze candidates every 5 minutes
    setInterval(async () => {
      try {
        const db = getDb();
        const candidates = await db.select()
          .from(tokens)
          .where(eq(tokens.status, 'CANDIDATE'));

        for (const token of candidates.slice(0, 20)) {
          await queueManager.addJob<AnalyzeTokenJob>(
            QUEUE_NAMES.ANALYZE_TOKEN,
            { mintAddress: token.mintAddress, priority: 'NORMAL' },
            { priority: 2 }
          );
        }

        logger.debug({ count: candidates.length }, 'Queued candidate re-analysis');
      } catch (error) {
        logger.warn({ error }, 'Failed to queue periodic analysis');
      }
    }, 5 * 60 * 1000);

    // Re-analyze tracking tokens every 15 minutes
    setInterval(async () => {
      try {
        const db = getDb();
        const tracking = await db.select()
          .from(tokens)
          .where(eq(tokens.status, 'TRACKING'));

        for (const token of tracking.slice(0, 50)) {
          await queueManager.addJob<AnalyzeTokenJob>(
            QUEUE_NAMES.ANALYZE_TOKEN,
            { mintAddress: token.mintAddress, priority: 'LOW' },
            { priority: 3 }
          );
        }

        logger.debug({ count: tracking.length }, 'Queued tracking re-analysis');
      } catch (error) {
        logger.warn({ error }, 'Failed to queue tracking analysis');
      }
    }, 15 * 60 * 1000);

    logger.info('Periodic analysis jobs started');
  }

  async stop(): Promise<void> {
    logger.info('Stopping analyzer service...');
    this.isRunning = false;

    await closeQueueManager();
    await this.redis.quit();
    await closeDb();

    logger.info('Analyzer service stopped');
  }

  getEngineStatuses() {
    return {
      risk: 'active',
      momentum: 'active',
      scoring: 'active',
      crossVerification: 'active',
      social: this.socialEngine ? 'active' : 'disabled',
    };
  }
}

// ============================================
// Main Entry Point
// ============================================

async function main() {
  const env = loadEnv();
  const service = new AnalyzerService();

  // Setup HTTP server for health/metrics
  const app = express();
  const port = Number(process.env.ANALYZER_METRICS_PORT) || 9091;

  // Health check
  const healthChecker = new HealthChecker({
    serviceName: 'analyzer',
  });

  app.get('/health', createHealthHandler(healthChecker));
  app.get('/ready', createHealthHandler(healthChecker));

  // Metrics endpoint
  app.get('/metrics', (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send(getMetrics().getMetrics());
  });

  // Engine status endpoint
  app.get('/status', (req, res) => {
    res.json(service.getEngineStatuses());
  });

  // Start HTTP server
  app.listen(port, () => {
    logger.info({ port }, 'Metrics server started');
  });

  // Start service
  await service.start();

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Received shutdown signal');
    await service.stop();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
