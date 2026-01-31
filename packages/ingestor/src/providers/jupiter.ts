/**
 * Jupiter Provider
 * Used for sellability checks (quote API)
 * Public API - No key required
 */

import {
  createLogger,
  RateLimiter,
  CircuitBreaker,
  withRetry,
  isNetworkError,
  PROGRAM_IDS,
  ProviderStatus,
} from '@solana-signal/shared';

const logger = createLogger('jupiter');

const BASE_URL = 'https://quote-api.jup.ag/v6';

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
    };
    percent: number;
  }>;
  contextSlot?: number;
  timeTaken?: number;
}

export interface SellabilityCheck {
  canBuy: boolean;
  canSell: boolean;
  buyQuote: JupiterQuote | null;
  sellQuote: JupiterQuote | null;
  buyPriceImpact: number | null;
  sellPriceImpact: number | null;
  error: string | null;
}

export class JupiterProvider {
  readonly name = 'jupiter';

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
            if (res.status === 400) {
              // Bad request might mean no route available
              return null;
            }
            throw new Error(`Jupiter API error: ${res.status}`);
          }
          return res.json();
        },
        { retryableErrors: isNetworkError, maxAttempts: 2 }
      );

      this.lastHealthCheck = new Date();
      return response as T;
    });
  }

  /**
   * Get a quote for swapping tokens
   */
  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: string,
    slippageBps: number = 100
  ): Promise<JupiterQuote | null> {
    try {
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount,
        slippageBps: slippageBps.toString(),
        onlyDirectRoutes: 'false',
        asLegacyTransaction: 'false',
      });

      const data = await this.fetch<JupiterQuote>(`/quote?${params.toString()}`);
      return data;
    } catch (error) {
      this.lastError = (error as Error).message;
      logger.debug({ inputMint, outputMint, error }, 'Failed to get Jupiter quote');
      return null;
    }
  }

  /**
   * Check if a token can be bought and sold (sellability test)
   * This is crucial for detecting honeypots/rugs
   */
  async checkSellability(
    tokenMint: string,
    testAmountLamports: string = '100000000' // 0.1 SOL
  ): Promise<SellabilityCheck> {
    const solMint = PROGRAM_IDS.WRAPPED_SOL.toBase58();

    try {
      // Test 1: Can we buy (SOL -> Token)?
      const buyQuote = await this.getQuote(solMint, tokenMint, testAmountLamports);

      // Test 2: Can we sell (Token -> SOL)?
      let sellQuote: JupiterQuote | null = null;
      let sellPriceImpact: number | null = null;

      if (buyQuote) {
        // Use the expected output amount for the sell test
        const sellAmount = buyQuote.outAmount;
        sellQuote = await this.getQuote(tokenMint, solMint, sellAmount);

        if (sellQuote) {
          sellPriceImpact = sellQuote.priceImpactPct;
        }
      }

      const canBuy = buyQuote !== null;
      const canSell = sellQuote !== null;

      // Calculate round-trip loss (honeypot indicator)
      let roundTripLoss: number | null = null;
      if (buyQuote && sellQuote) {
        const inputSol = BigInt(testAmountLamports);
        const outputSol = BigInt(sellQuote.outAmount);
        roundTripLoss = Number(inputSol - outputSol) / Number(inputSol) * 100;
      }

      return {
        canBuy,
        canSell,
        buyQuote,
        sellQuote,
        buyPriceImpact: buyQuote?.priceImpactPct || null,
        sellPriceImpact,
        error: null,
      };
    } catch (error) {
      const errorMsg = (error as Error).message;
      this.lastError = errorMsg;
      logger.debug({ tokenMint, error }, 'Sellability check failed');

      return {
        canBuy: false,
        canSell: false,
        buyQuote: null,
        sellQuote: null,
        buyPriceImpact: null,
        sellPriceImpact: null,
        error: errorMsg,
      };
    }
  }

  /**
   * Get the best price for a token in USD equivalent
   */
  async getPrice(tokenMint: string): Promise<number | null> {
    try {
      const solMint = PROGRAM_IDS.WRAPPED_SOL.toBase58();
      const usdcMint = PROGRAM_IDS.USDC.toBase58();

      // Get quote: 1 token -> SOL -> USDC approximation
      // Using a small amount to minimize price impact
      const oneToken = '1000000'; // 1 token with 6 decimals

      const quote = await this.getQuote(tokenMint, usdcMint, oneToken);
      if (quote) {
        // Output is in USDC (6 decimals)
        return Number(quote.outAmount) / 1e6;
      }

      // Fallback: token -> SOL and use SOL price
      const solQuote = await this.getQuote(tokenMint, solMint, oneToken);
      if (solQuote) {
        // Would need SOL/USD price from another source
        // For now, return null
        return null;
      }

      return null;
    } catch (error) {
      this.lastError = (error as Error).message;
      logger.debug({ tokenMint, error }, 'Failed to get token price via Jupiter');
      return null;
    }
  }

  /**
   * Get available routes for a token pair
   */
  async getRoutes(inputMint: string, outputMint: string): Promise<string[]> {
    const quote = await this.getQuote(inputMint, outputMint, '1000000000');
    if (!quote?.routePlan) return [];

    return quote.routePlan.map((route) => route.swapInfo.label);
  }

  /**
   * Check if token is tradeable on Jupiter
   */
  async isTokenTradeable(tokenMint: string): Promise<boolean> {
    const sellability = await this.checkSellability(tokenMint);
    return sellability.canBuy && sellability.canSell;
  }
}
