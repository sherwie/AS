/**
 * Momentum Engine
 * Analyzes trading activity and holder growth patterns
 */

import {
  IMomentumEngine,
  MomentumAnalysis,
  VelocityResult,
  PatternResult,
  VelocityMetric,
  createLogger,
  Cache,
  CACHE_TTL,
  getDb,
  tradesAggregate,
  pools,
  holdersSnapshots,
  Timeframe,
} from '@solana-signal/shared';
import { eq, and, gte, desc, sql } from 'drizzle-orm';

const logger = createLogger('momentum-engine');

export class MomentumEngine implements IMomentumEngine {
  private cache: Cache;

  constructor(cache: Cache) {
    this.cache = cache;
  }

  async analyze(mintAddress: string): Promise<MomentumAnalysis> {
    logger.debug({ mintAddress }, 'Starting momentum analysis');

    const explanation: string[] = [];
    let momentumScore = 0;

    // Get velocity metrics for different timeframes
    const [
      volumeVelocity,
      tradeVelocity,
      traderGrowth,
      holderGrowth,
    ] = await Promise.all([
      this.getVolumeVelocity(mintAddress, '5m'),
      this.getTradeVelocity(mintAddress, '5m'),
      this.getTraderGrowth(mintAddress, '15m'),
      this.getHolderGrowth(mintAddress, '1h'),
    ]);

    // Calculate weighted momentum score
    const weights = {
      volume: 0.3,
      trade: 0.25,
      trader: 0.25,
      holder: 0.2,
    };

    momentumScore =
      volumeVelocity.score * weights.volume +
      tradeVelocity.score * weights.trade +
      traderGrowth.score * weights.trader +
      holderGrowth.score * weights.holder;

    // Generate explanations
    if (volumeVelocity.changePercent > 50) {
      explanation.push(`Volume surging: +${volumeVelocity.changePercent.toFixed(0)}% in 5m`);
    } else if (volumeVelocity.changePercent < -30) {
      explanation.push(`Volume declining: ${volumeVelocity.changePercent.toFixed(0)}% in 5m`);
    }

    if (tradeVelocity.changePercent > 30) {
      explanation.push(`Trade activity increasing: +${tradeVelocity.changePercent.toFixed(0)}% trades`);
    }

    if (traderGrowth.changePercent > 20) {
      explanation.push(`New traders entering: +${traderGrowth.changePercent.toFixed(0)}% unique traders`);
    }

    if (holderGrowth.changePercent > 10) {
      explanation.push(`Holder count growing: +${holderGrowth.changePercent.toFixed(0)}%`);
    }

    // Pattern detection
    const [dipBuy, liquidityStability] = await Promise.all([
      this.detectDipBuy(mintAddress),
      this.checkLiquidityStability(mintAddress),
    ]);

    if (dipBuy.detected) {
      explanation.push('Dip-buy pattern detected (bullish)');
      momentumScore = Math.min(100, momentumScore + 10);
    }

    if (!liquidityStability.detected) {
      explanation.push('Warning: Liquidity instability detected');
      momentumScore = Math.max(0, momentumScore - 20);
    }

    // Cap score
    momentumScore = Math.min(100, Math.max(0, momentumScore));

    const analysis: MomentumAnalysis = {
      tokenMint: mintAddress,
      analyzedAt: new Date(),
      momentumScore,
      volumeVelocity: this.toVelocityMetric('Volume', volumeVelocity, '5m'),
      tradeVelocity: this.toVelocityMetric('Trades', tradeVelocity, '5m'),
      traderGrowth: this.toVelocityMetric('Traders', traderGrowth, '15m'),
      holderGrowth: this.toVelocityMetric('Holders', holderGrowth, '1h'),
      dipBuyDetected: dipBuy.detected,
      liquidityStable: liquidityStability.detected,
      explanation,
    };

    // Cache result
    await this.cache.set(
      this.cache.token(mintAddress).momentum,
      analysis,
      CACHE_TTL.MOMENTUM
    );

    logger.info({
      mintAddress,
      momentumScore,
      volumeChange: volumeVelocity.changePercent,
      tradeChange: tradeVelocity.changePercent,
    }, 'Momentum analysis completed');

    return analysis;
  }

  private toVelocityMetric(
    name: string,
    result: VelocityResult,
    timeframe: Timeframe
  ): VelocityMetric {
    return {
      name,
      current: result.current,
      previous: result.previous,
      changePercent: result.changePercent,
      timeframe,
      score: result.score,
    };
  }

  async getVolumeVelocity(
    mintAddress: string,
    timeframe: Timeframe
  ): Promise<VelocityResult> {
    try {
      const db = getDb();
      const periodMs = this.timeframeToMs(timeframe);
      const now = new Date();
      const currentStart = new Date(now.getTime() - periodMs);
      const previousStart = new Date(currentStart.getTime() - periodMs);

      // Get aggregated volume for current and previous periods
      const [currentAgg, previousAgg] = await Promise.all([
        db.select({
          totalVolume: sql<number>`SUM(COALESCE(total_volume_usd, 0))`,
        })
          .from(tradesAggregate)
          .where(
            and(
              eq(tradesAggregate.tokenMint, mintAddress),
              gte(tradesAggregate.periodStart, currentStart)
            )
          ),
        db.select({
          totalVolume: sql<number>`SUM(COALESCE(total_volume_usd, 0))`,
        })
          .from(tradesAggregate)
          .where(
            and(
              eq(tradesAggregate.tokenMint, mintAddress),
              gte(tradesAggregate.periodStart, previousStart),
              sql`period_start < ${currentStart}`
            )
          ),
      ]);

      const current = currentAgg[0]?.totalVolume || 0;
      const previous = previousAgg[0]?.totalVolume || 0;

      return this.calculateVelocity(current, previous);
    } catch (error) {
      logger.debug({ mintAddress, error }, 'Failed to get volume velocity');
      return { name: 'Volume', current: 0, previous: 0, changePercent: 0, score: 50 };
    }
  }

  async getTradeVelocity(
    mintAddress: string,
    timeframe: Timeframe
  ): Promise<VelocityResult> {
    try {
      const db = getDb();
      const periodMs = this.timeframeToMs(timeframe);
      const now = new Date();
      const currentStart = new Date(now.getTime() - periodMs);
      const previousStart = new Date(currentStart.getTime() - periodMs);

      const [currentAgg, previousAgg] = await Promise.all([
        db.select({
          tradeCount: sql<number>`SUM(buy_count + sell_count)`,
        })
          .from(tradesAggregate)
          .where(
            and(
              eq(tradesAggregate.tokenMint, mintAddress),
              gte(tradesAggregate.periodStart, currentStart)
            )
          ),
        db.select({
          tradeCount: sql<number>`SUM(buy_count + sell_count)`,
        })
          .from(tradesAggregate)
          .where(
            and(
              eq(tradesAggregate.tokenMint, mintAddress),
              gte(tradesAggregate.periodStart, previousStart),
              sql`period_start < ${currentStart}`
            )
          ),
      ]);

      const current = currentAgg[0]?.tradeCount || 0;
      const previous = previousAgg[0]?.tradeCount || 0;

      return this.calculateVelocity(current, previous);
    } catch (error) {
      logger.debug({ mintAddress, error }, 'Failed to get trade velocity');
      return { name: 'Trades', current: 0, previous: 0, changePercent: 0, score: 50 };
    }
  }

  async getTraderGrowth(
    mintAddress: string,
    timeframe: Timeframe
  ): Promise<VelocityResult> {
    try {
      const db = getDb();
      const periodMs = this.timeframeToMs(timeframe);
      const now = new Date();
      const currentStart = new Date(now.getTime() - periodMs);
      const previousStart = new Date(currentStart.getTime() - periodMs);

      const [currentAgg, previousAgg] = await Promise.all([
        db.select({
          traders: sql<number>`SUM(unique_traders)`,
        })
          .from(tradesAggregate)
          .where(
            and(
              eq(tradesAggregate.tokenMint, mintAddress),
              gte(tradesAggregate.periodStart, currentStart)
            )
          ),
        db.select({
          traders: sql<number>`SUM(unique_traders)`,
        })
          .from(tradesAggregate)
          .where(
            and(
              eq(tradesAggregate.tokenMint, mintAddress),
              gte(tradesAggregate.periodStart, previousStart),
              sql`period_start < ${currentStart}`
            )
          ),
      ]);

      const current = currentAgg[0]?.traders || 0;
      const previous = previousAgg[0]?.traders || 0;

      return this.calculateVelocity(current, previous);
    } catch (error) {
      logger.debug({ mintAddress, error }, 'Failed to get trader growth');
      return { name: 'Traders', current: 0, previous: 0, changePercent: 0, score: 50 };
    }
  }

  async getHolderGrowth(
    mintAddress: string,
    timeframe: Timeframe
  ): Promise<VelocityResult> {
    try {
      const db = getDb();
      const periodMs = this.timeframeToMs(timeframe);
      const now = new Date();
      const currentStart = new Date(now.getTime() - periodMs);

      // Get latest and earlier holder snapshots
      const snapshots = await db.select()
        .from(holdersSnapshots)
        .where(eq(holdersSnapshots.tokenMint, mintAddress))
        .orderBy(desc(holdersSnapshots.timestamp))
        .limit(10);

      if (snapshots.length < 2) {
        return { name: 'Holders', current: 0, previous: 0, changePercent: 0, score: 50 };
      }

      const current = snapshots[0].totalHolders;
      const previous = snapshots.find(s => s.timestamp < currentStart)?.totalHolders || snapshots[snapshots.length - 1].totalHolders;

      return this.calculateVelocity(current, previous);
    } catch (error) {
      logger.debug({ mintAddress, error }, 'Failed to get holder growth');
      return { name: 'Holders', current: 0, previous: 0, changePercent: 0, score: 50 };
    }
  }

  async detectDipBuy(mintAddress: string): Promise<PatternResult> {
    try {
      const db = getDb();

      // Get recent price candles
      const recentTrades = await db.select()
        .from(tradesAggregate)
        .where(eq(tradesAggregate.tokenMint, mintAddress))
        .orderBy(desc(tradesAggregate.periodStart))
        .limit(20);

      if (recentTrades.length < 5) {
        return {
          detected: false,
          confidence: 0,
          details: 'Insufficient data for dip-buy detection',
          data: { dataPoints: recentTrades.length },
        };
      }

      // Look for pattern: price drop followed by volume increase
      let dipBuyDetected = false;
      let confidence = 0;

      for (let i = 0; i < recentTrades.length - 2; i++) {
        const current = recentTrades[i];
        const prev1 = recentTrades[i + 1];
        const prev2 = recentTrades[i + 2];

        if (!current.closePrice || !prev1.closePrice || !prev2.closePrice) continue;

        // Check for price dip
        const priceDip = (prev1.closePrice - current.closePrice) / prev1.closePrice * 100;
        const priceRecovery = current.closePrice > prev2.closePrice;

        // Check for volume spike on dip
        const volumeSpike = (current.totalVolumeUsd || 0) > ((prev1.totalVolumeUsd || 0) * 1.5);

        // Check for buy dominance
        const buyDominance = current.buyCount > current.sellCount;

        if (priceDip > 5 && priceRecovery && volumeSpike && buyDominance) {
          dipBuyDetected = true;
          confidence = Math.min(1, 0.5 + priceDip / 20);
          break;
        }
      }

      return {
        detected: dipBuyDetected,
        confidence,
        details: dipBuyDetected
          ? 'Dip-buy pattern: price dropped, then recovered with high buy volume'
          : 'No dip-buy pattern detected',
        data: { dataPoints: recentTrades.length },
      };
    } catch (error) {
      logger.debug({ mintAddress, error }, 'Failed to detect dip-buy pattern');
      return {
        detected: false,
        confidence: 0,
        details: `Detection failed: ${(error as Error).message}`,
        data: {},
      };
    }
  }

  async checkLiquidityStability(mintAddress: string): Promise<PatternResult> {
    try {
      const db = getDb();

      // Get pool history
      const tokenPools = await db.select()
        .from(pools)
        .where(eq(pools.tokenMint, mintAddress));

      if (tokenPools.length === 0) {
        return {
          detected: false,
          confidence: 0,
          details: 'No pools found',
          data: {},
        };
      }

      // Check if any pools are still active
      const activePools = tokenPools.filter(p => p.isActive);
      if (activePools.length === 0) {
        return {
          detected: false,
          confidence: 0,
          details: 'All pools inactive (potential liquidity pulled)',
          data: { poolCount: tokenPools.length, activeCount: 0 },
        };
      }

      // Check liquidity amounts
      const totalLiquidity = activePools.reduce(
        (sum, p) => sum + (p.liquidityUsd || 0),
        0
      );

      // If we had historical liquidity data, we could check for drops
      // For now, just verify liquidity exists
      const stable = totalLiquidity > 0;

      return {
        detected: stable,
        confidence: stable ? 0.7 : 0,
        details: stable
          ? `Liquidity stable: $${totalLiquidity.toFixed(2)} across ${activePools.length} pool(s)`
          : 'Liquidity appears unstable or removed',
        data: { totalLiquidity, poolCount: tokenPools.length, activeCount: activePools.length },
      };
    } catch (error) {
      logger.debug({ mintAddress, error }, 'Failed to check liquidity stability');
      return {
        detected: true, // Don't penalize on error
        confidence: 0.5,
        details: `Stability check incomplete: ${(error as Error).message}`,
        data: {},
      };
    }
  }

  private timeframeToMs(timeframe: Timeframe): number {
    switch (timeframe) {
      case '1m': return 60 * 1000;
      case '5m': return 5 * 60 * 1000;
      case '15m': return 15 * 60 * 1000;
      case '1h': return 60 * 60 * 1000;
      case '4h': return 4 * 60 * 60 * 1000;
      case '1d': return 24 * 60 * 60 * 1000;
    }
  }

  private calculateVelocity(current: number, previous: number): VelocityResult {
    const changePercent = previous > 0
      ? ((current - previous) / previous) * 100
      : current > 0 ? 100 : 0;

    // Score based on change:
    // 0% change = 50 (neutral)
    // +100% = 100 (max bullish)
    // -100% = 0 (max bearish)
    let score = 50 + (changePercent / 2);
    score = Math.min(100, Math.max(0, score));

    return {
      name: '',
      current,
      previous,
      changePercent,
      score,
    };
  }
}
