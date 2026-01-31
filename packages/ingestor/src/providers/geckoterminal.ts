/**
 * GeckoTerminal Market Data Provider
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

const logger = createLogger('geckoterminal');

const BASE_URL = 'https://api.geckoterminal.com/api/v2';

export class GeckoTerminalProvider implements IMarketDataProvider {
  readonly name = 'geckoterminal';

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
          const res = await fetch(`${BASE_URL}${endpoint}`, {
            headers: {
              Accept: 'application/json',
            },
          });
          if (!res.ok) {
            throw new Error(`GeckoTerminal API error: ${res.status}`);
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
      const data = await this.fetch<GeckoTokenResponse>(
        `/networks/solana/tokens/${mintAddress}`
      );

      if (!data?.data?.attributes) return null;

      const attrs = data.data.attributes;
      return {
        mintAddress,
        priceUsd: attrs.price_usd ? parseFloat(attrs.price_usd) : 0,
        priceNative: 0, // GeckoTerminal doesn't provide native price directly
        change1h: null,
        change24h: attrs.price_change_percentage?.h24
          ? parseFloat(attrs.price_change_percentage.h24)
          : null,
        volume24h: attrs.volume_usd?.h24 ? parseFloat(attrs.volume_usd.h24) : null,
        liquidity: attrs.total_reserve_in_usd
          ? parseFloat(attrs.total_reserve_in_usd)
          : null,
        marketCap: attrs.market_cap_usd ? parseFloat(attrs.market_cap_usd) : null,
        fdv: attrs.fdv_usd ? parseFloat(attrs.fdv_usd) : null,
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
    try {
      // First get the pool for this token
      const pools = await this.getPoolsByToken(mintAddress);
      if (!pools.length) return [];

      const poolAddress = pools[0].poolAddress;
      const gtTimeframe = this.convertTimeframe(timeframe);

      const data = await this.fetch<GeckoOHLCVResponse>(
        `/networks/solana/pools/${poolAddress}/ohlcv/${gtTimeframe}?limit=${limit}`
      );

      if (!data?.data?.attributes?.ohlcv_list) return [];

      return data.data.attributes.ohlcv_list.map((candle: number[]) => ({
        timestamp: new Date(candle[0] * 1000),
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
      }));
    } catch (error) {
      this.lastError = (error as Error).message;
      logger.debug({ mintAddress, error }, 'Failed to get price history');
      return [];
    }
  }

  private convertTimeframe(timeframe: Timeframe): string {
    switch (timeframe) {
      case '1m':
        return 'minute';
      case '5m':
        return 'minute';
      case '15m':
        return 'minute';
      case '1h':
        return 'hour';
      case '4h':
        return 'hour';
      case '1d':
        return 'day';
      default:
        return 'minute';
    }
  }

  async getPoolInfo(poolAddress: string): Promise<PoolData | null> {
    try {
      const data = await this.fetch<GeckoPoolResponse>(
        `/networks/solana/pools/${poolAddress}`
      );

      if (!data?.data?.attributes) return null;

      return this.transformPool(data.data);
    } catch (error) {
      this.lastError = (error as Error).message;
      logger.debug({ poolAddress, error }, 'Failed to get pool info');
      return null;
    }
  }

  async getPoolsByToken(mintAddress: string): Promise<PoolData[]> {
    try {
      const data = await this.fetch<GeckoPoolsResponse>(
        `/networks/solana/tokens/${mintAddress}/pools`
      );

      if (!data?.data) return [];

      return data.data.map((pool) => this.transformPool(pool));
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
      const data = await this.fetch<GeckoSearchResponse>(
        `/search/pools?query=${encodeURIComponent(query)}&network=solana`
      );

      if (!data?.data) return [];

      // Deduplicate by token address
      const seen = new Set<string>();
      const results: TokenSearchResult[] = [];

      for (const pool of data.data) {
        const attrs = pool.attributes;
        const mint = attrs.base_token_id?.replace('solana_', '');
        if (!mint || seen.has(mint)) continue;
        seen.add(mint);

        results.push({
          mintAddress: mint,
          name: attrs.name || null,
          symbol: attrs.base_token_symbol || null,
          priceUsd: attrs.base_token_price_usd
            ? parseFloat(attrs.base_token_price_usd)
            : null,
          volume24h: attrs.volume_usd?.h24 ? parseFloat(attrs.volume_usd.h24) : null,
          liquidity: attrs.reserve_in_usd
            ? parseFloat(attrs.reserve_in_usd)
            : null,
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
      const data = await this.fetch<GeckoNewPoolsResponse>(
        `/networks/solana/new_pools?page=1`
      );

      if (!data?.data) return [];

      const sinceTs = since.getTime();
      return data.data
        .filter((pool) => {
          const createdAt = pool.attributes.pool_created_at
            ? new Date(pool.attributes.pool_created_at).getTime()
            : 0;
          return createdAt >= sinceTs;
        })
        .slice(0, limit)
        .map((pool) => this.transformPool(pool));
    } catch (error) {
      this.lastError = (error as Error).message;
      logger.debug({ error }, 'Failed to get new pairs');
      return [];
    }
  }

  async getTrendingPools(limit: number = 50): Promise<PoolData[]> {
    try {
      const data = await this.fetch<GeckoTrendingResponse>(
        `/networks/solana/trending_pools?page=1`
      );

      if (!data?.data) return [];

      return data.data.slice(0, limit).map((pool) => this.transformPool(pool));
    } catch (error) {
      this.lastError = (error as Error).message;
      logger.debug({ error }, 'Failed to get trending pools');
      return [];
    }
  }

  private transformPool(pool: GeckoPool): PoolData {
    const attrs = pool.attributes;
    const mint = attrs.base_token_id?.replace('solana_', '') || '';

    return {
      poolAddress: pool.id.replace('solana_', ''),
      dex: attrs.dex_id || 'unknown',
      tokenMint: mint,
      tokenName: attrs.name || null,
      tokenSymbol: attrs.base_token_symbol || null,
      quoteMint: attrs.quote_token_id?.replace('solana_', '') || '',
      quoteSymbol: attrs.quote_token_symbol || 'SOL',
      priceUsd: attrs.base_token_price_usd
        ? parseFloat(attrs.base_token_price_usd)
        : null,
      priceNative: attrs.base_token_price_native_currency
        ? parseFloat(attrs.base_token_price_native_currency)
        : 0,
      liquidity: attrs.reserve_in_usd ? parseFloat(attrs.reserve_in_usd) : 0,
      volume24h: attrs.volume_usd?.h24 ? parseFloat(attrs.volume_usd.h24) : 0,
      txns24h: attrs.transactions?.h24
        ? (attrs.transactions.h24.buys || 0) + (attrs.transactions.h24.sells || 0)
        : 0,
      createdAt: attrs.pool_created_at
        ? new Date(attrs.pool_created_at)
        : new Date(),
      url: `https://www.geckoterminal.com/solana/pools/${pool.id.replace('solana_', '')}`,
    };
  }
}

// GeckoTerminal API response types
interface GeckoTokenResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      address: string;
      name: string;
      symbol: string;
      decimals: number;
      price_usd?: string;
      total_reserve_in_usd?: string;
      market_cap_usd?: string;
      fdv_usd?: string;
      volume_usd?: { h24?: string };
      price_change_percentage?: { h24?: string };
    };
  };
}

interface GeckoPoolResponse {
  data: GeckoPool;
}

interface GeckoPoolsResponse {
  data: GeckoPool[];
}

interface GeckoSearchResponse {
  data: GeckoPool[];
}

interface GeckoNewPoolsResponse {
  data: GeckoPool[];
}

interface GeckoTrendingResponse {
  data: GeckoPool[];
}

interface GeckoOHLCVResponse {
  data: {
    attributes: {
      ohlcv_list: number[][];
    };
  };
}

interface GeckoPool {
  id: string;
  type: string;
  attributes: {
    name?: string;
    address?: string;
    base_token_id?: string;
    base_token_symbol?: string;
    base_token_price_usd?: string;
    base_token_price_native_currency?: string;
    quote_token_id?: string;
    quote_token_symbol?: string;
    dex_id?: string;
    reserve_in_usd?: string;
    volume_usd?: { h24?: string };
    transactions?: {
      h24?: { buys?: number; sells?: number };
    };
    pool_created_at?: string;
  };
}
