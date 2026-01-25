/**
 * Ingestor Service - Main Entry Point
 * Detects new tokens, pools, and trades on Solana
 */

import { Redis } from 'ioredis';
import express from 'express';
import {
  createLogger,
  loadEnv,
  getProviderConfig,
  getFeatureAvailability,
  printFeatureStatus,
  createProviderRateLimiters,
  createProviderCircuitBreakers,
  getQueueManager,
  closeQueueManager,
  QUEUE_NAMES,
  TokenDiscoveredJob,
  PoolDiscoveredJob,
  PumpfunEventJob,
  HealthChecker,
  createHealthHandler,
  getMetrics,
  getDb,
  closeDb,
  Cache,
} from '@solana-signal/shared';
import { Connection } from '@solana/web3.js';
import { SolanaRpcProvider } from './providers/solana-rpc.js';
import { PumpfunProvider } from './providers/pumpfun.js';
import { DexScreenerProvider } from './providers/dexscreener.js';
import { GeckoTerminalProvider } from './providers/geckoterminal.js';
import { JupiterProvider } from './providers/jupiter.js';

const logger = createLogger('ingestor');

// ============================================
// Service Setup
// ============================================

class IngestorService {
  private redis: Redis;
  private cache: Cache;
  private rateLimiters: ReturnType<typeof createProviderRateLimiters>;
  private circuitBreakers: ReturnType<typeof createProviderCircuitBreakers>;

  // Providers
  private solanaProvider: SolanaRpcProvider;
  private pumpfunProvider: PumpfunProvider;
  private dexScreenerProvider: DexScreenerProvider;
  private geckoTerminalProvider: GeckoTerminalProvider;
  private jupiterProvider: JupiterProvider;

  // Subscriptions
  private activeSubscriptions: Set<string> = new Set();
  private isRunning = false;

  constructor() {
    const env = loadEnv();
    const config = getProviderConfig();
    const features = getFeatureAvailability();

    // Initialize Redis
    this.redis = new Redis(env.REDIS_URL);
    this.cache = new Cache({ redis: this.redis });

    // Initialize rate limiters and circuit breakers
    this.rateLimiters = createProviderRateLimiters(this.redis);
    this.circuitBreakers = createProviderCircuitBreakers();

    // Get RPC URLs (with fallback to public RPC)
    const httpUrl = config.solanaRpcHttp || 'https://api.mainnet-beta.solana.com';
    const wsUrl = config.solanaRpcWs || 'wss://api.mainnet-beta.solana.com';

    logger.info({ httpUrl: httpUrl.substring(0, 50) + '...' }, 'Using Solana RPC');

    // Initialize Solana connections for PumpfunProvider
    const httpConnection = new Connection(httpUrl, {
      commitment: 'confirmed',
    });
    const wsConnection = new Connection(wsUrl, {
      commitment: 'confirmed',
      wsEndpoint: wsUrl,
    });

    // Initialize providers
    this.solanaProvider = new SolanaRpcProvider(
      httpUrl,
      wsUrl,
      this.rateLimiters.rpc,
      this.circuitBreakers.rpc
    );

    this.pumpfunProvider = new PumpfunProvider(
      httpConnection,
      wsConnection,
      this.rateLimiters.rpc,
      this.circuitBreakers.rpc
    );

    this.dexScreenerProvider = new DexScreenerProvider(
      this.rateLimiters.dexscreener,
      this.circuitBreakers.dexscreener
    );

    this.geckoTerminalProvider = new GeckoTerminalProvider(
      this.rateLimiters.geckoterminal,
      this.circuitBreakers.geckoterminal
    );

    this.jupiterProvider = new JupiterProvider(
      this.rateLimiters.jupiter,
      this.circuitBreakers.jupiter
    );

    logger.info('Ingestor service initialized');
  }

  async start(): Promise<void> {
    logger.info('Starting ingestor service...');
    printFeatureStatus();

    const config = getProviderConfig();

    try {
      // Connect to Solana
      await this.solanaProvider.connect();

      // Start subscriptions based on enabled features
      await this.startSubscriptions(config);

      // Start periodic polling for market data
      this.startPolling();

      this.isRunning = true;
      logger.info('Ingestor service started successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to start ingestor service');
      throw error;
    }
  }

  private async startSubscriptions(config: ReturnType<typeof getProviderConfig>): Promise<void> {
    const queueManager = getQueueManager();

    // Subscribe to new mints
    const mintSubId = await this.solanaProvider.subscribeToMints(async (mint) => {
      logger.info({ mint: mint.mintAddress, signature: mint.signature }, 'New mint detected');

      getMetrics().increment('tokens_discovered_total', 1, { source: 'spl_mint' });

      const job: TokenDiscoveredJob = {
        mintAddress: mint.mintAddress,
        discoverySource: 'SPL_MINT',
        signature: mint.signature,
        timestamp: mint.timestamp,
      };

      await queueManager.addJob(QUEUE_NAMES.TOKEN_DISCOVERED, job, { priority: 1 });
    });
    this.activeSubscriptions.add(mintSubId);

    // Subscribe to Raydium pools
    if (config.enableRaydium) {
      const raydiumSubId = await this.solanaProvider.subscribeToPools('RAYDIUM', async (pool) => {
        logger.info({ pool: pool.poolAddress, token: pool.tokenMint }, 'New Raydium pool detected');

        getMetrics().increment('pools_discovered_total', 1, { dex: 'raydium' });

        const job: PoolDiscoveredJob = {
          poolAddress: pool.poolAddress,
          dex: 'RAYDIUM',
          tokenMint: pool.tokenMint,
          quoteMint: pool.quoteMint,
          signature: pool.signature,
          timestamp: pool.timestamp,
          initialLiquidity: {
            tokenReserve: pool.initialTokenReserve.toString(),
            quoteReserve: pool.initialQuoteReserve.toString(),
          },
        };

        await queueManager.addJob(QUEUE_NAMES.POOL_DISCOVERED, job, { priority: 1 });
      });
      this.activeSubscriptions.add(raydiumSubId);
    }

    // Subscribe to Orca pools
    if (config.enableOrca) {
      try {
        const orcaSubId = await this.solanaProvider.subscribeToPools('ORCA', async (pool) => {
          logger.info({ pool: pool.poolAddress, token: pool.tokenMint }, 'New Orca pool detected');

          getMetrics().increment('pools_discovered_total', 1, { dex: 'orca' });

          const job: PoolDiscoveredJob = {
            poolAddress: pool.poolAddress,
            dex: 'ORCA',
            tokenMint: pool.tokenMint,
            quoteMint: pool.quoteMint,
            signature: pool.signature,
            timestamp: pool.timestamp,
          };

          await queueManager.addJob(QUEUE_NAMES.POOL_DISCOVERED, job, { priority: 1 });
        });
        this.activeSubscriptions.add(orcaSubId);
      } catch (error) {
        logger.warn({ error }, 'Failed to subscribe to Orca pools');
      }
    }

    // Subscribe to Meteora pools
    if (config.enableMeteora) {
      try {
        const meteoraSubId = await this.solanaProvider.subscribeToPools('METEORA', async (pool) => {
          logger.info({ pool: pool.poolAddress, token: pool.tokenMint }, 'New Meteora pool detected');

          getMetrics().increment('pools_discovered_total', 1, { dex: 'meteora' });

          const job: PoolDiscoveredJob = {
            poolAddress: pool.poolAddress,
            dex: 'METEORA',
            tokenMint: pool.tokenMint,
            quoteMint: pool.quoteMint,
            signature: pool.signature,
            timestamp: pool.timestamp,
          };

          await queueManager.addJob(QUEUE_NAMES.POOL_DISCOVERED, job, { priority: 1 });
        });
        this.activeSubscriptions.add(meteoraSubId);
      } catch (error) {
        logger.warn({ error }, 'Failed to subscribe to Meteora pools');
      }
    }

    // Subscribe to Pump.fun events
    if (config.enablePumpfun) {
      const pumpfunSubId = await this.pumpfunProvider.subscribeToBondingCurves(async (event) => {
        logger.info({
          type: event.type,
          mint: event.mintAddress,
          signature: event.signature
        }, 'Pump.fun event detected');

        getMetrics().increment('tokens_discovered_total', 1, { source: 'pumpfun' });

        const job: PumpfunEventJob = {
          type: event.type,
          signature: event.signature,
          mintAddress: event.mintAddress,
          bondingCurveAddress: event.bondingCurveAddress,
          timestamp: event.timestamp,
          tokenAmount: event.tokenAmount?.toString(),
          solAmount: event.solAmount?.toString(),
          traderWallet: event.traderWallet,
          raydiumPoolAddress: event.raydiumPoolAddress,
        };

        await queueManager.addJob(QUEUE_NAMES.PUMPFUN_EVENT, job, {
          priority: event.type === 'CREATE' ? 1 : 2
        });

        // Also create a token discovered job for new creates
        if (event.type === 'CREATE') {
          const tokenJob: TokenDiscoveredJob = {
            mintAddress: event.mintAddress,
            discoverySource: 'PUMPFUN_CREATE',
            signature: event.signature,
            timestamp: event.timestamp,
          };
          await queueManager.addJob(QUEUE_NAMES.TOKEN_DISCOVERED, tokenJob, { priority: 1 });
        }
      });
      this.activeSubscriptions.add(pumpfunSubId);
    }

    logger.info({ subscriptions: this.activeSubscriptions.size }, 'Subscriptions started');
  }

  private startPolling(): void {
    const queueManager = getQueueManager();

    // Poll DexScreener for new pairs every 60 seconds
    setInterval(async () => {
      try {
        const since = new Date(Date.now() - 120000); // Last 2 minutes
        const newPairs = await this.dexScreenerProvider.getNewPairs(since, 50);

        for (const pair of newPairs) {
          // Check if we already know this token
          const cached = await this.cache.get(`token:${pair.tokenMint}:seen`);
          if (cached) continue;

          logger.debug({ mint: pair.tokenMint, pool: pair.poolAddress }, 'New pair from DexScreener');

          const job: TokenDiscoveredJob = {
            mintAddress: pair.tokenMint,
            discoverySource: 'DEXSCREENER',
            timestamp: pair.createdAt,
            metadata: {
              name: pair.tokenName || undefined,
              symbol: pair.tokenSymbol || undefined,
            },
          };

          await queueManager.addJob(QUEUE_NAMES.TOKEN_DISCOVERED, job, { priority: 2 });
          await this.cache.set(`token:${pair.tokenMint}:seen`, true, 3600);
        }
      } catch (error) {
        logger.warn({ error }, 'DexScreener polling failed');
      }
    }, 60000);

    // Poll GeckoTerminal for new pairs every 60 seconds
    setInterval(async () => {
      try {
        const since = new Date(Date.now() - 120000);
        const newPairs = await this.geckoTerminalProvider.getNewPairs(since, 50);

        for (const pair of newPairs) {
          const cached = await this.cache.get(`token:${pair.tokenMint}:seen`);
          if (cached) continue;

          logger.debug({ mint: pair.tokenMint }, 'New pair from GeckoTerminal');

          const job: TokenDiscoveredJob = {
            mintAddress: pair.tokenMint,
            discoverySource: 'GECKOTERMINAL',
            timestamp: pair.createdAt,
            metadata: {
              name: pair.tokenName || undefined,
              symbol: pair.tokenSymbol || undefined,
            },
          };

          await queueManager.addJob(QUEUE_NAMES.TOKEN_DISCOVERED, job, { priority: 2 });
          await this.cache.set(`token:${pair.tokenMint}:seen`, true, 3600);
        }
      } catch (error) {
        logger.warn({ error }, 'GeckoTerminal polling failed');
      }
    }, 60000);

    logger.info('Polling started');
  }

  async stop(): Promise<void> {
    logger.info('Stopping ingestor service...');
    this.isRunning = false;

    // Unsubscribe from all
    for (const subId of this.activeSubscriptions) {
      try {
        await this.solanaProvider.unsubscribe(subId);
      } catch (error) {
        logger.warn({ subId, error }, 'Failed to unsubscribe');
      }
    }
    this.activeSubscriptions.clear();

    // Disconnect
    await this.solanaProvider.disconnect();
    await closeQueueManager();
    await this.redis.quit();
    await closeDb();

    logger.info('Ingestor service stopped');
  }

  getProviderStatuses() {
    return {
      solana: this.solanaProvider.getStatus(),
      pumpfun: this.pumpfunProvider.getStatus(),
      dexscreener: this.dexScreenerProvider.getStatus(),
      geckoterminal: this.geckoTerminalProvider.getStatus(),
      jupiter: this.jupiterProvider.getStatus(),
    };
  }
}

// ============================================
// Main Entry Point
// ============================================

async function main() {
  console.log('Starting ingestor...');
  console.log('Current directory:', process.cwd());

  const env = loadEnv();
  const config = getProviderConfig();
  console.log('RPC URL:', config.solanaRpcHttp);
  console.log('Has Helius:', config.heliusApiKey ? 'Yes' : 'No');

  const service = new IngestorService();

  // Setup HTTP server for health/metrics
  const app = express();
  const port = env.METRICS_PORT || 9090;

  // Health check
  const healthChecker = new HealthChecker({
    serviceName: 'ingestor',
    additionalChecks: [
      {
        name: 'solana-rpc',
        check: async () => {
          const status = service.getProviderStatuses().solana;
          return { healthy: status.available, message: status.lastError || undefined };
        },
      },
    ],
  });

  app.get('/health', createHealthHandler(healthChecker));
  app.get('/ready', createHealthHandler(healthChecker));

  // Metrics endpoint
  app.get('/metrics', (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send(getMetrics().getMetrics());
  });

  // Provider status endpoint
  app.get('/status', (req, res) => {
    res.json(service.getProviderStatuses());
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
  console.error('Fatal error:', error);
  console.error('Message:', error?.message);
  console.error('Stack:', error?.stack);
  process.exit(1);
});
