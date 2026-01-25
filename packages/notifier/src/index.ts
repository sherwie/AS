/**
 * Notifier Service - Main Entry Point
 * Sends alerts through configured channels
 */

import { Redis } from 'ioredis';
import express from 'express';
import {
  createLogger,
  loadEnv,
  getProviderConfig,
  getQueueManager,
  closeQueueManager,
  QUEUE_NAMES,
  SendAlertJob,
  HealthChecker,
  createHealthHandler,
  getMetrics,
  getDb,
  closeDb,
  Cache,
  alerts,
  tokens,
  scores,
  Alert,
  AlertDetails,
  AlertChannel,
  getDexScreenerUrl,
  getBirdeyeUrl,
  getSolscanUrl,
} from '@solana-signal/shared';
import { eq, desc } from 'drizzle-orm';
import { DiscordWebhookChannel } from './channels/discord-webhook.js';
import { v4 as uuidv4 } from 'uuid';

const logger = createLogger('notifier');

class NotifierService {
  private redis: Redis;
  private cache: Cache;

  // Channels
  private discordWebhook: DiscordWebhookChannel;
  private isRunning = false;

  constructor() {
    const env = loadEnv();
    const config = getProviderConfig();

    // Initialize Redis and cache
    this.redis = new Redis(env.REDIS_URL);
    this.cache = new Cache({ redis: this.redis });

    // Initialize channels
    this.discordWebhook = new DiscordWebhookChannel(config.discordWebhookUrl || undefined);

    logger.info({
      discordWebhookEnabled: config.discordWebhookUrl !== null,
    }, 'Notifier service initialized');
  }

  async start(): Promise<void> {
    logger.info('Starting notifier service...');

    const queueManager = getQueueManager();

    // Create worker for alert jobs
    queueManager.createWorker<SendAlertJob, void>(
      QUEUE_NAMES.SEND_ALERT,
      async (job) => {
        await this.handleSendAlert(job.data);
      },
      { concurrency: 3 }
    );

    this.isRunning = true;
    logger.info('Notifier service started successfully');
  }

  private async handleSendAlert(data: SendAlertJob): Promise<void> {
    const { alertId, type, tokenMint } = data;

    logger.info({ alertId, type, tokenMint }, 'Processing alert');

    try {
      // Build full alert object
      const alert = await this.buildAlert(alertId, type, tokenMint);
      if (!alert) {
        logger.warn({ alertId }, 'Failed to build alert');
        return;
      }

      // Send through enabled channels
      const channels: AlertChannel[] = [];

      // Discord webhook
      if (this.discordWebhook.getStatus().enabled) {
        const result = await this.discordWebhook.send(alert);
        channels.push({
          type: 'DISCORD_WEBHOOK',
          sent: result.success,
          error: result.error,
        });

        if (result.success) {
          getMetrics().increment('alerts_sent_total', 1, { channel: 'discord', type });
        }
      }

      // Persist alert to database
      const db = getDb();
      await db.insert(alerts).values({
        id: alert.id,
        type: alert.type,
        tokenMint: alert.tokenMint,
        survivalScore: alert.survivalScore,
        runnerScore: alert.runnerScore,
        confidenceBand: alert.confidenceBand,
        title: alert.title,
        summary: alert.summary,
        details: alert.details as any,
        createdAt: alert.createdAt,
        sentAt: new Date(),
        channels: channels as any,
      });

      logger.info({
        alertId: alert.id,
        type,
        channelsSent: channels.filter(c => c.sent).length,
      }, 'Alert processed');
    } catch (error) {
      logger.error({ alertId, error }, 'Failed to process alert');
      getMetrics().increment('api_errors_total', 1, { type: 'alert' });
    }
  }

  private async buildAlert(
    alertId: string,
    type: string,
    tokenMint: string
  ): Promise<Alert | null> {
    const db = getDb();

    // Get token info
    const tokenInfo = await db.select()
      .from(tokens)
      .where(eq(tokens.mintAddress, tokenMint))
      .limit(1);

    if (tokenInfo.length === 0) {
      return null;
    }

    const token = tokenInfo[0];

    // Get latest score
    const latestScore = await db.select()
      .from(scores)
      .where(eq(scores.tokenMint, tokenMint))
      .orderBy(desc(scores.scoredAt))
      .limit(1);

    if (latestScore.length === 0) {
      return null;
    }

    const score = latestScore[0];

    // Get cached price data
    const priceData = await this.cache.get<{
      priceUsd: number;
      liquidity: number;
      marketCap: number;
    }>(this.cache.token(tokenMint).price);

    // Build title and summary
    const title = this.buildTitle(type, token.name || token.symbol || 'Unknown', tokenMint);
    const summary = this.buildSummary(type, score);

    // Build details
    const details: AlertDetails = {
      tokenName: token.name,
      tokenSymbol: token.symbol,
      priceUsd: priceData?.priceUsd || null,
      liquidityUsd: priceData?.liquidity || null,
      marketCapUsd: priceData?.marketCap || null,
      keyMetrics: {
        survivalScore: score.survivalScore,
        runnerScore: score.runnerScore,
        dataCompleteness: score.dataCompleteness,
      },
      explanation: score.explanation || [],
      redFlags: score.redFlags || [],
      greenFlags: score.greenFlags || [],
      dexscreenerUrl: getDexScreenerUrl(tokenMint),
      birdeyeUrl: getBirdeyeUrl(tokenMint),
      solscanUrl: getSolscanUrl(tokenMint, 'token'),
    };

    return {
      id: alertId || uuidv4(),
      type: type as Alert['type'],
      tokenMint,
      survivalScore: score.survivalScore,
      runnerScore: score.runnerScore,
      confidenceBand: score.confidenceBand as Alert['confidenceBand'],
      title,
      summary,
      details,
      createdAt: new Date(),
      sentAt: null,
      channels: [],
    };
  }

  private buildTitle(type: string, name: string, mint: string): string {
    const shortMint = `${mint.slice(0, 4)}...${mint.slice(-4)}`;

    switch (type) {
      case 'GENESIS_CANDIDATE':
        return `Genesis Candidate: ${name || shortMint}`;
      case 'IGNITION_BREAKOUT':
        return `Ignition Breakout: ${name || shortMint}`;
      case 'RISK_ALERT':
        return `Risk Alert: ${name || shortMint}`;
      default:
        return `Signal: ${name || shortMint}`;
    }
  }

  private buildSummary(type: string, score: any): string {
    const survival = score.survivalScore?.toFixed(0) || 'N/A';
    const runner = score.runnerScore?.toFixed(0) || 'N/A';

    switch (type) {
      case 'GENESIS_CANDIDATE':
        return `Early-stage token showing strong survival indicators (${survival}/100) with adequate momentum (${runner}/100). Consider for watchlist.`;
      case 'IGNITION_BREAKOUT':
        return `Token exhibiting strong momentum (${runner}/100) with acceptable safety (${survival}/100). Potential breakout conditions.`;
      case 'RISK_ALERT':
        return `WARNING: Token flagged for safety concerns. Survival score: ${survival}/100. Review red flags carefully.`;
      default:
        return `Token signal: Survival ${survival}/100, Runner ${runner}/100.`;
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping notifier service...');
    this.isRunning = false;

    await closeQueueManager();
    await this.redis.quit();
    await closeDb();

    logger.info('Notifier service stopped');
  }

  getChannelStatuses() {
    return {
      discordWebhook: this.discordWebhook.getStatus(),
    };
  }
}

// ============================================
// Main Entry Point
// ============================================

async function main() {
  const env = loadEnv();
  const service = new NotifierService();

  // Setup HTTP server for health/metrics
  const app = express();
  const port = Number(process.env.NOTIFIER_METRICS_PORT) || 9092;

  // Health check
  const healthChecker = new HealthChecker({
    serviceName: 'notifier',
    additionalChecks: [
      {
        name: 'discord-webhook',
        check: async () => {
          const status = service.getChannelStatuses().discordWebhook;
          return { healthy: status.enabled, message: status.lastError || undefined };
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

  // Channel status endpoint
  app.get('/status', (req, res) => {
    res.json(service.getChannelStatuses());
  });

  // Test endpoint
  app.post('/test', async (req, res) => {
    const channels = service.getChannelStatuses();
    const results: Record<string, boolean> = {};

    if (channels.discordWebhook.enabled) {
      const discord = new DiscordWebhookChannel();
      results.discordWebhook = await discord.testConnection();
    }

    res.json({ tested: results });
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
