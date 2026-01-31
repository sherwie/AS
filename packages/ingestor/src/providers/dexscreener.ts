/**
 * DexScreener Market Data Provider
 * Public API - No key required
 */

import {
  IMarketDataProvider,
  ProviderStatus,
  PriceData,
  PriceCandle,
  PoolData,
  TokenSearchResult,
  createLogger,
  RateLimiter,
  CircuitBreaker,
  withRetry,
  isNetworkError,
  Timeframe,
} from '@solana-signal/shared';

const logger = createLogger('dexscreener');

const BASE_URL = 'https://api.dexscreener.com';

export class DexScreenerProvider implements IMarketDataProvider {
  readonly name = 'dexscreener';

  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private lastHealthCheck: Date | null = null;
  private lastError: string | null = null;

  constructor(rateLimiter: RateLimiter, circuitBreaker: CircuitBreaker) {
    this.rateLimiter = rateLimiter;
    this.circuitBreaker = circuitBreaker;
  }

  getStatus(): ProviderStatus {
    return {
      name: this.name,
      enabled: true,
      available: this.circuitBreaker.canExecute(),
      requiresApiKey: false,
      hasApiKey: false,
      lastHealthCheck: this.lastHealthCheck,
      lastError: this.lastError,
      requestsRemaining: this.rateLimiter.getAvailableTokens(),
    };
  }

  private async fetch<T>(endpoint: string): Promise<T | null> {
    return this.circuitBreaker.execute(async () => {
      await this.rateLimiter.waitForToken();

      const response = await withRetry(
        async () => {
          const res = await fetch(`${BASE_URL}${endpoint}`);
          if (!res.ok) {
            throw new Error(`DexScreener API error: ${res.status}`);
          }
          return res.json();
        },
        { retryableErrors: isNetworkError }
      );

      this.lastHealthCheck = new Date();
      return response as T;
    });
  }

  async getTokenPrice(mintAddress: string): Promise<PriceData | null> {
    try {
      const data = await this.fetch<DexScreenerTokenResponse>(
        `/latest/dex/tokens/${mintAddress}`
      );

      if (!data?.pairs?.length) return null;

      // Find the best pair (highest liquidity on Solana)
      const solanaPairs = data.pairs.filter((p) => p.chainId === 'solana');
      if (!solanaPairs.length) return null;

      const bestPair = solanaPairs.reduce((best, current) =>
        (current.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? current : best
      );

      return {
        mintAddress,
        priceUsd: bestPair.priceUsd ? parseFloat(bestPair.priceUsd) : 0,
        priceNative: bestPair.priceNative ? parseFloat(bestPair.priceNative) : 0,
        change1h: bestPair.priceChange?.h1 || null,
        change24h: bestPair.priceChange?.h24 || null,
        volume24h: bestPair.volume?.h24 || null,
        liquidity: bestPair.liquidity?.usd || null,
        marketCap: bestPair.fdv || null,
        fdv: bestPair.fdv || null,
        timestamp: new Date(),
      };
    } catch (error) {
      this.lastError = (error as Error).message;
      logger.debug({ mintAddress, error }, 'Failed to get token price');
      return null;
    }
  }

  async getTokenPriceHistory(
    mintAddress: string,
    timeframe: Timeframe,
    limit: number = 100
  ): Promise<PriceCandle[]> {
    // DexScreener doesn't provide historical candle data in free API
    // Would need to track prices over time ourselves
    logger.debug('DexScreener does not provide historical price data');
    return [];
  }

  async getPoolInfo(poolAddress: string): Promise<PoolData | null> {
    try {
      const data = await this.fetch<DexScreenerPairResponse>(
        `/latest/dex/pairs/solana/${poolAddress}`
      );

      if (!data?.pair) return null;

      const pair = data.pair;
      return this.transformPair(pair);
    } catch (error) {
      this.lastError = (error as Error).message;
      logger.debug({ poolAddress, error }, 'Failed to get pool info');
      return null;
    }
  }

  async getPoolsByToken(mintAddress: string): Promise<PoolData[]> {
    try {
      const data = await this.fetch<DexScreenerTokenResponse>(
        `/latest/dex/tokens/${mintAddress}`
      );

      if (!data?.pairs) return [];

      return data.pairs
        .filter((p) => p.chainId === 'solana')
        .map((p) => this.transformPair(p));
    } catch (error) {
      this.lastError = (error as Error).message;
      logger.debug({ mintAddress, error }, 'Failed to get pools by token');
      return [];
    }
  }

  async getVolume24h(mintAddress: string): Promise<number | null> {
    const price = await this.getTokenPrice(mintAddress);
    return price?.volume24h || null;
  }

  async getLiquidity(mintAddress: string): Promise<number | null> {
    const price = await this.getTokenPrice(mintAddress);
    return price?.liquidity || null;
  }

  async searchToken(query: string): Promise<TokenSearchResult[]> {
    try {
      const data = await this.fetch<DexScreenerSearchResponse>(
        `/latest/dex/search?q=${encodeURIComponent(query)}`
      );

      if (!data?.pairs) return [];

      const solanaPairs = data.pairs.filter((p) => p.chainId === 'solana');

      // Deduplicate by token mint
      const seen = new Set<string>();
      const results: TokenSearchResult[] = [];

      for (const pair of solanaPairs) {
        const mint = pair.baseToken?.address;
        if (!mint || seen.has(mint)) continue;
        seen.add(mint);

        results.push({
          mintAddress: mint,
          name: pair.baseToken?.name || null,
          symbol: pair.baseToken?.symbol || null,
          priceUsd: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
          volume24h: pair.volume?.h24 || null,
          liquidity: pair.liquidity?.usd || null,
        });
      }

      return results;
    } catch (error) {
      this.lastError = (error as Error).message;
      logger.debug({ query, error }, 'Failed to search tokens');
      return [];
    }
  }

  async getNewPairs(since: Date, limit: number = 100): Promise<PoolData[]> {
    try {
      // DexScreener's latest pairs endpoint
      const data = await this.fetch<DexScreenerLatestResponse>(
        `/latest/dex/pairs/solana?order=pairCreatedAt`
      );

      if (!data?.pairs) return [];

      const sinceTs = since.getTime();
      return data.pairs
        .filter((p) => {
          const createdAt = p.pairCreatedAt ? p.pairCreatedAt * 1000 : 0;
          return createdAt >= sinceTs;
        })
        .slice(0, limit)
        .map((p) => this.transformPair(p));
    } catch (error) {
      this.lastError = (error as Error).message;
      logger.debug({ error }, 'Failed to get new pairs');
      return [];
    }
  }

  private transformPair(pair: DexScreenerPair): PoolData {
    return {
      poolAddress: pair.pairAddress,
      dex: pair.dexId || 'unknown',
      tokenMint: pair.baseToken?.address || '',
      tokenName: pair.baseToken?.name || null,
      tokenSymbol: pair.baseToken?.symbol || null,
      quoteMint: pair.quoteToken?.address || '',
      quoteSymbol: pair.quoteToken?.symbol || 'SOL',
      priceUsd: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
      priceNative: pair.priceNative ? parseFloat(pair.priceNative) : 0,
      liquidity: pair.liquidity?.usd || 0,
      volume24h: pair.volume?.h24 || 0,
      txns24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
      createdAt: new Date((pair.pairCreatedAt || Date.now() / 1000) * 1000),
      url: pair.url || `https://dexscreener.com/solana/${pair.pairAddress}`,
    };
  }
}

// DexScreener API response types
interface DexScreenerTokenResponse {
  pairs: DexScreenerPair[];
}

interface DexScreenerPairResponse {
  pair: DexScreenerPair;
}

interface DexScreenerSearchResponse {
  pairs: DexScreenerPair[];
}

interface DexScreenerLatestResponse {
  pairs: DexScreenerPair[];
}

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken?: {
    address: string;
    name: string;
    symbol: string;
  };
  quoteToken?: {
    address: string;
    name: string;
    symbol: string;
  };
  priceNative?: string;
  priceUsd?: string;
  txns?: {
    h1?: { buys: number; sells: number };
    h24?: { buys: number; sells: number };
  };
  volume?: {
    h1?: number;
    h24?: number;
  };
  priceChange?: {
    h1?: number;
    h24?: number;
  };
  liquidity?: {
    usd?: number;
    base?: number;
    quote?: number;
  };
  fdv?: number;
  pairCreatedAt?: number;
}
