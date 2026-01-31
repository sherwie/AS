/**
 * Cross-Verification Engine
 * Verifies data across multiple sources to detect anomalies
 */

import {
  ICrossVerificationEngine,
  CrossVerification,
  SourceData,
  MetricComparison,
  DataSource,
  createLogger,
  Cache,
  CACHE_TTL,
  getProviderConfig,
  RateLimiter,
  CircuitBreaker,
  withRetry,
  isNetworkError,
} from '@solana-signal/shared';

const logger = createLogger('cross-verification');

interface MarketDataProvider {
  name: string;
  getTokenPrice(mintAddress: string): Promise<{
    priceUsd: number;
    volume24h: number | null;
    liquidity: number | null;
    marketCap: number | null;
  } | null>;
}

export class CrossVerificationEngine implements ICrossVerificationEngine {
  private cache: Cache;
  private dexScreenerProvider: MarketDataProvider | null;
  private geckoTerminalProvider: MarketDataProvider | null;
  private birdeyeProvider: MarketDataProvider | null;

  constructor(
    cache: Cache,
    providers?: {
      dexScreener?: MarketDataProvider;
      geckoTerminal?: MarketDataProvider;
      birdeye?: MarketDataProvider;
    }
  ) {
    this.cache = cache;
    this.dexScreenerProvider = providers?.dexScreener || null;
    this.geckoTerminalProvider = providers?.geckoTerminal || null;
    this.birdeyeProvider = providers?.birdeye || null;
  }

  async verify(mintAddress: string): Promise<CrossVerification> {
    logger.debug({ mintAddress }, 'Starting cross-verification');

    const sources: DataSource[] = [];
    const sourceData: SourceData[] = [];

    // Fetch from all available sources in parallel
    const fetchResults = await Promise.all([
      this.fetchFromDexScreener(mintAddress),
      this.fetchFromGeckoTerminal(mintAddress),
      this.fetchFromBirdeye(mintAddress),
    ]);

    // DexScreener
    sources.push({
      name: 'DexScreener',
      enabled: this.dexScreenerProvider !== null,
      available: fetchResults[0] !== null,
      lastFetch: fetchResults[0] ? new Date() : null,
      price: fetchResults[0]?.price || null,
      volume24h: fetchResults[0]?.volume24h || null,
      liquidity: fetchResults[0]?.liquidity || null,
      marketCap: fetchResults[0]?.marketCap || null,
    });
    if (fetchResults[0]) sourceData.push(fetchResults[0]);

    // GeckoTerminal
    sources.push({
      name: 'GeckoTerminal',
      enabled: this.geckoTerminalProvider !== null,
      available: fetchResults[1] !== null,
      lastFetch: fetchResults[1] ? new Date() : null,
      price: fetchResults[1]?.price || null,
      volume24h: fetchResults[1]?.volume24h || null,
      liquidity: fetchResults[1]?.liquidity || null,
      marketCap: fetchResults[1]?.marketCap || null,
    });
    if (fetchResults[1]) sourceData.push(fetchResults[1]);

    // Birdeye
    sources.push({
      name: 'Birdeye',
      enabled: this.birdeyeProvider !== null,
      available: fetchResults[2] !== null,
      lastFetch: fetchResults[2] ? new Date() : null,
      price: fetchResults[2]?.price || null,
      volume24h: fetchResults[2]?.volume24h || null,
      liquidity: fetchResults[2]?.liquidity || null,
      marketCap: fetchResults[2]?.marketCap || null,
    });
    if (fetchResults[2]) sourceData.push(fetchResults[2]);

    // Compare metrics
    const comparison = this.compareMetrics(sourceData);
    const confidencePenalty = this.calculateConfidencePenalty(comparison);

    // Generate explanation
    const explanation = this.generateExplanation(sources, comparison, confidencePenalty);

    const verification: CrossVerification = {
      tokenMint: mintAddress,
      verifiedAt: new Date(),
      sources,
      priceDiscrepancy: comparison.priceDiscrepancy,
      volumeDiscrepancy: comparison.volumeDiscrepancy,
      liquidityDiscrepancy: comparison.liquidityDiscrepancy,
      confidencePenalty,
      explanation,
    };

    // Cache result
    await this.cache.set(
      `token:${mintAddress}:verification`,
      verification,
      CACHE_TTL.PRICE
    );

    logger.info({
      mintAddress,
      sourcesUsed: comparison.sourcesUsed,
      priceDiscrepancy: comparison.priceDiscrepancy,
      confidencePenalty,
    }, 'Cross-verification completed');

    return verification;
  }

  async fetchFromDexScreener(mintAddress: string): Promise<SourceData | null> {
    if (!this.dexScreenerProvider) return null;

    try {
      const data = await this.dexScreenerProvider.getTokenPrice(mintAddress);
      if (!data) return null;

      return {
        name: 'DexScreener',
        timestamp: new Date(),
        price: data.priceUsd,
        volume24h: data.volume24h,
        liquidity: data.liquidity,
        marketCap: data.marketCap,
      };
    } catch (error) {
      logger.debug({ mintAddress, error }, 'Failed to fetch from DexScreener');
      return null;
    }
  }

  async fetchFromGeckoTerminal(mintAddress: string): Promise<SourceData | null> {
    if (!this.geckoTerminalProvider) return null;

    try {
      const data = await this.geckoTerminalProvider.getTokenPrice(mintAddress);
      if (!data) return null;

      return {
        name: 'GeckoTerminal',
        timestamp: new Date(),
        price: data.priceUsd,
        volume24h: data.volume24h,
        liquidity: data.liquidity,
        marketCap: data.marketCap,
      };
    } catch (error) {
      logger.debug({ mintAddress, error }, 'Failed to fetch from GeckoTerminal');
      return null;
    }
  }

  async fetchFromBirdeye(mintAddress: string): Promise<SourceData | null> {
    if (!this.birdeyeProvider) return null;

    try {
      const data = await this.birdeyeProvider.getTokenPrice(mintAddress);
      if (!data) return null;

      return {
        name: 'Birdeye',
        timestamp: new Date(),
        price: data.priceUsd,
        volume24h: data.volume24h,
        liquidity: data.liquidity,
        marketCap: data.marketCap,
      };
    } catch (error) {
      logger.debug({ mintAddress, error }, 'Failed to fetch from Birdeye');
      return null;
    }
  }

  async fetchFromChain(mintAddress: string): Promise<SourceData | null> {
    // On-chain data would come from direct pool queries
    // This is implemented in the ingestor and stored in the database
    // For cross-verification, we mainly use external APIs
    return null;
  }

  compareMetrics(sources: SourceData[]): MetricComparison {
    if (sources.length < 2) {
      return {
        priceDiscrepancy: 0,
        volumeDiscrepancy: 0,
        liquidityDiscrepancy: 0,
        sourcesUsed: sources.length,
        sourcesAvailable: sources.length,
      };
    }

    // Calculate discrepancies as percentage difference from mean
    const priceDiscrepancy = this.calculateDiscrepancy(
      sources.map(s => s.price).filter((p): p is number => p !== null)
    );

    const volumeDiscrepancy = this.calculateDiscrepancy(
      sources.map(s => s.volume24h).filter((v): v is number => v !== null)
    );

    const liquidityDiscrepancy = this.calculateDiscrepancy(
      sources.map(s => s.liquidity).filter((l): l is number => l !== null)
    );

    return {
      priceDiscrepancy,
      volumeDiscrepancy,
      liquidityDiscrepancy,
      sourcesUsed: sources.length,
      sourcesAvailable: 4, // Max possible sources
    };
  }

  private calculateDiscrepancy(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    if (mean === 0) return 0;

    const maxDeviation = Math.max(
      ...values.map(v => Math.abs(v - mean))
    );

    return (maxDeviation / mean) * 100;
  }

  calculateConfidencePenalty(comparison: MetricComparison): number {
    let penalty = 0;

    // Penalize for price discrepancy (most important)
    if (comparison.priceDiscrepancy > 5) {
      penalty += Math.min(0.3, comparison.priceDiscrepancy / 100);
    }

    // Penalize for volume discrepancy
    if (comparison.volumeDiscrepancy > 20) {
      penalty += Math.min(0.2, comparison.volumeDiscrepancy / 200);
    }

    // Penalize for liquidity discrepancy
    if (comparison.liquidityDiscrepancy > 20) {
      penalty += Math.min(0.2, comparison.liquidityDiscrepancy / 200);
    }

    // Penalize for few sources
    if (comparison.sourcesUsed < 2) {
      penalty += 0.2;
    } else if (comparison.sourcesUsed < 3) {
      penalty += 0.1;
    }

    return Math.min(1, penalty);
  }

  private generateExplanation(
    sources: DataSource[],
    comparison: MetricComparison,
    penalty: number
  ): string[] {
    const explanation: string[] = [];

    const availableSources = sources.filter(s => s.available);
    explanation.push(`Data verified across ${availableSources.length} source(s)`);

    if (comparison.priceDiscrepancy > 10) {
      explanation.push(`Price discrepancy: ${comparison.priceDiscrepancy.toFixed(1)}% (warning: data sources disagree)`);
    } else if (comparison.priceDiscrepancy > 5) {
      explanation.push(`Minor price discrepancy: ${comparison.priceDiscrepancy.toFixed(1)}%`);
    } else if (comparison.sourcesUsed >= 2) {
      explanation.push(`Price consistent across sources (${comparison.priceDiscrepancy.toFixed(1)}% variance)`);
    }

    if (comparison.volumeDiscrepancy > 30) {
      explanation.push(`Volume data inconsistent: ${comparison.volumeDiscrepancy.toFixed(0)}% variance`);
    }

    if (comparison.liquidityDiscrepancy > 30) {
      explanation.push(`Liquidity data inconsistent: ${comparison.liquidityDiscrepancy.toFixed(0)}% variance`);
    }

    if (penalty > 0.3) {
      explanation.push(`Confidence reduced by ${(penalty * 100).toFixed(0)}% due to data quality issues`);
    }

    // Add source status
    const unavailable = sources.filter(s => s.enabled && !s.available);
    if (unavailable.length > 0) {
      explanation.push(`Unavailable sources: ${unavailable.map(s => s.name).join(', ')}`);
    }

    return explanation;
  }
}
