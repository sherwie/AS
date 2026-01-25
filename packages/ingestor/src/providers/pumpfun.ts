/**
 * Pump.fun Provider
 * Detects new token launches and bonding curve activity
 */

import { Connection, PublicKey } from '@solana/web3.js';
import {
  IPumpfunProvider,
  ProviderStatus,
  PumpfunEvent,
  PumpfunBondingCurve,
  PumpfunToken,
  createLogger,
  RateLimiter,
  CircuitBreaker,
  withRetry,
  isNetworkError,
  PROGRAM_IDS,
} from '@solana-signal/shared';

const logger = createLogger('pumpfun');

// Pump.fun bonding curve account structure (simplified)
const BONDING_CURVE_SIZE = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1; // discriminator + mint + ... + complete flag

export class PumpfunProvider implements IPumpfunProvider {
  readonly name = 'pumpfun';

  private connection: Connection;
  private wsConnection: Connection;
  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private subscriptions: Map<string, number> = new Map();
  private lastHealthCheck: Date | null = null;
  private lastError: string | null = null;

  // Public API endpoint (if available and ToS-compliant)
  private apiBaseUrl = 'https://frontend-api.pump.fun';
  private usePublicApi = false; // Disabled by default - enable if ToS allows

  constructor(
    connection: Connection,
    wsConnection: Connection,
    rateLimiter: RateLimiter,
    circuitBreaker: CircuitBreaker
  ) {
    this.connection = connection;
    this.wsConnection = wsConnection;
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

  // ============================================
  // On-chain Detection
  // ============================================

  async subscribeToBondingCurves(
    callback: (event: PumpfunEvent) => void
  ): Promise<string> {
    const subscriptionId = `pumpfun:${Date.now()}`;

    const subId = this.wsConnection.onLogs(
      PROGRAM_IDS.PUMPFUN_PROGRAM,
      (logs, context) => {
        this.processPumpfunLogs(logs, context, callback);
      },
      'confirmed'
    );

    this.subscriptions.set(subscriptionId, subId);
    logger.info({ subscriptionId }, 'Subscribed to pump.fun events');
    return subscriptionId;
  }

  private processPumpfunLogs(
    logs: { signature: string; logs: string[]; err: unknown },
    context: { slot: number },
    callback: (event: PumpfunEvent) => void
  ): void {
    if (logs.err) return;

    // Determine event type from logs
    const logStr = logs.logs.join(' ');
    let eventType: PumpfunEvent['type'] | null = null;

    if (logStr.includes('Create') || logStr.includes('create')) {
      eventType = 'CREATE';
    } else if (logStr.includes('Buy') || logStr.includes('buy')) {
      eventType = 'BUY';
    } else if (logStr.includes('Sell') || logStr.includes('sell')) {
      eventType = 'SELL';
    } else if (logStr.includes('complete') || logStr.includes('Complete') || logStr.includes('graduate')) {
      eventType = 'GRADUATE';
    }

    if (!eventType) return;

    logger.debug({ signature: logs.signature, eventType }, 'Detected pump.fun event');
    this.fetchAndProcessPumpfunEvent(logs.signature, context.slot, eventType, callback);
  }

  private async fetchAndProcessPumpfunEvent(
    signature: string,
    slot: number,
    eventType: PumpfunEvent['type'],
    callback: (event: PumpfunEvent) => void
  ): Promise<void> {
    try {
      await this.rateLimiter.waitForToken();

      const tx = await withRetry(
        () =>
          this.connection.getParsedTransaction(signature, {
            maxSupportedTransactionVersion: 0,
          }),
        { retryableErrors: isNetworkError }
      );

      if (!tx?.meta || tx.meta.err) return;

      const event = this.extractPumpfunEvent(tx, signature, slot, eventType);
      if (event) {
        callback(event);
      }
    } catch (error) {
      logger.debug({ signature, error }, 'Failed to process pump.fun transaction');
    }
  }

  private extractPumpfunEvent(
    tx: any,
    signature: string,
    slot: number,
    eventType: PumpfunEvent['type']
  ): PumpfunEvent | null {
    const accountKeys = tx.transaction.message.accountKeys.map((k: any) =>
      typeof k === 'string' ? k : k.pubkey
    );

    // Find accounts based on event type
    // The exact account order depends on the pump.fun instruction layout
    // These indices are approximate - verify with actual program IDL

    let mintAddress: string | undefined;
    let bondingCurveAddress: string | undefined;
    let traderWallet: string | undefined;

    // For CREATE events, the mint is usually one of the first accounts
    // For BUY/SELL, we need to look at token balance changes

    const postTokenBalances = tx.meta?.postTokenBalances || [];
    const preTokenBalances = tx.meta?.preTokenBalances || [];

    // Find mint address from token balances
    const tokenMints = new Set(postTokenBalances.map((b: any) => b.mint));
    tokenMints.delete(PROGRAM_IDS.WRAPPED_SOL.toBase58());
    mintAddress = Array.from(tokenMints)[0];

    if (!mintAddress && accountKeys.length > 2) {
      // Try to find mint from account keys for CREATE events
      // Skip program IDs and known accounts
      for (const key of accountKeys) {
        const keyStr = typeof key === 'string' ? key : key.toBase58();
        if (
          keyStr !== PROGRAM_IDS.PUMPFUN_PROGRAM.toBase58() &&
          keyStr !== PROGRAM_IDS.TOKEN_PROGRAM.toBase58() &&
          keyStr !== PROGRAM_IDS.WRAPPED_SOL.toBase58()
        ) {
          // This might be the mint
          mintAddress = keyStr;
          break;
        }
      }
    }

    if (!mintAddress) return null;

    // Derive bonding curve address
    try {
      const [bcAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from('bonding-curve'), new PublicKey(mintAddress).toBuffer()],
        PROGRAM_IDS.PUMPFUN_PROGRAM
      );
      bondingCurveAddress = bcAddress.toBase58();
    } catch {
      return null;
    }

    // Find trader for BUY/SELL events
    if (eventType === 'BUY' || eventType === 'SELL') {
      // The signer is typically the trader
      const signers = accountKeys.filter(
        (k: any) => k.signer === true || (typeof k !== 'string' && k.signer)
      );
      traderWallet = signers[0]?.pubkey?.toBase58() || signers[0];

      if (!traderWallet) {
        // Fallback: first non-program account
        traderWallet = accountKeys[0]?.pubkey?.toBase58() || accountKeys[0];
      }
    }

    // Calculate amounts from balance changes
    let tokenAmount: bigint | undefined;
    let solAmount: bigint | undefined;

    if (eventType === 'BUY' || eventType === 'SELL') {
      for (const post of postTokenBalances) {
        const pre = preTokenBalances.find(
          (p: any) => p.accountIndex === post.accountIndex
        );
        const preAmt = pre ? BigInt(pre.uiTokenAmount.amount) : BigInt(0);
        const postAmt = BigInt(post.uiTokenAmount.amount);
        const diff = postAmt - preAmt;

        if (post.mint === mintAddress && diff !== BigInt(0)) {
          tokenAmount = diff > 0 ? diff : -diff;
        } else if (post.mint === PROGRAM_IDS.WRAPPED_SOL.toBase58() && diff !== BigInt(0)) {
          solAmount = diff > 0 ? diff : -diff;
        }
      }
    }

    // For GRADUATE events, try to find the Raydium pool address
    let raydiumPoolAddress: string | undefined;
    if (eventType === 'GRADUATE') {
      // Look for Raydium AMM V4 in the transaction
      const raydiumIndex = accountKeys.findIndex(
        (k: any) =>
          (typeof k === 'string' ? k : k.pubkey?.toBase58()) ===
          PROGRAM_IDS.RAYDIUM_AMM_V4.toBase58()
      );
      if (raydiumIndex >= 0) {
        // The pool address is typically a few accounts before the program ID
        raydiumPoolAddress = accountKeys[raydiumIndex - 1]?.pubkey?.toBase58() ||
          accountKeys[raydiumIndex - 1];
      }
    }

    return {
      type: eventType,
      signature,
      mintAddress,
      bondingCurveAddress,
      timestamp: new Date((tx.blockTime || Date.now() / 1000) * 1000),
      slot,
      tokenAmount: tokenAmount?.toString() as unknown as bigint,
      solAmount: solAmount?.toString() as unknown as bigint,
      traderWallet,
      raydiumPoolAddress,
    };
  }

  async getBondingCurveInfo(
    bondingCurveAddress: string
  ): Promise<PumpfunBondingCurve | null> {
    return this.circuitBreaker.execute(async () => {
      await this.rateLimiter.waitForToken();

      const bcPubkey = new PublicKey(bondingCurveAddress);
      const accountInfo = await withRetry(
        () => this.connection.getAccountInfo(bcPubkey),
        { retryableErrors: isNetworkError }
      );

      if (!accountInfo) return null;

      return this.parseBondingCurveAccount(bondingCurveAddress, accountInfo.data);
    });
  }

  private parseBondingCurveAccount(
    address: string,
    data: Buffer
  ): PumpfunBondingCurve | null {
    try {
      // Pump.fun bonding curve layout (approximate - verify with actual IDL)
      // 8 bytes: discriminator
      // 32 bytes: mint
      // 8 bytes: virtual_token_reserves
      // 8 bytes: virtual_sol_reserves
      // 8 bytes: real_token_reserves
      // 8 bytes: real_sol_reserves
      // 1 byte: complete flag

      let offset = 8; // Skip discriminator

      const mint = new PublicKey(data.subarray(offset, offset + 32));
      offset += 32;

      const virtualTokenReserves = data.readBigUInt64LE(offset);
      offset += 8;

      const virtualSolReserves = data.readBigUInt64LE(offset);
      offset += 8;

      const realTokenReserves = data.readBigUInt64LE(offset);
      offset += 8;

      const realSolReserves = data.readBigUInt64LE(offset);
      offset += 8;

      const complete = data.readUInt8(offset) === 1;

      // Calculate progress (pump.fun graduates at ~85 SOL / ~$12k market cap)
      const GRADUATION_SOL = BigInt(85_000_000_000); // 85 SOL in lamports
      const progress = Math.min(
        100,
        (Number(realSolReserves) / Number(GRADUATION_SOL)) * 100
      );

      return {
        address,
        mintAddress: mint.toBase58(),
        virtualTokenReserves,
        virtualSolReserves,
        realTokenReserves,
        realSolReserves,
        progress,
        complete,
      };
    } catch (error) {
      logger.debug({ address, error }, 'Failed to parse bonding curve account');
      return null;
    }
  }

  async getTokenByBondingCurve(
    bondingCurveAddress: string
  ): Promise<PumpfunToken | null> {
    const bcInfo = await this.getBondingCurveInfo(bondingCurveAddress);
    if (!bcInfo) return null;

    // Fetch additional token info
    try {
      await this.rateLimiter.waitForToken();

      const mintPubkey = new PublicKey(bcInfo.mintAddress);
      const accountInfo = await this.connection.getParsedAccountInfo(mintPubkey);

      if (!accountInfo.value) return null;

      // Get metadata
      const [metadataAddress] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata'),
          PROGRAM_IDS.METAPLEX_TOKEN_METADATA.toBuffer(),
          mintPubkey.toBuffer(),
        ],
        PROGRAM_IDS.METAPLEX_TOKEN_METADATA
      );

      const metadataInfo = await this.connection.getAccountInfo(metadataAddress);
      let name = 'Unknown';
      let symbol = 'UNK';

      if (metadataInfo) {
        // Parse metadata (simplified)
        const metaData = metadataInfo.data;
        // Skip first 1 + 32 + 32 bytes (key, update authority, mint)
        let offset = 65;
        const nameLen = metaData.readUInt32LE(offset);
        offset += 4;
        name = metaData.subarray(offset, offset + nameLen).toString('utf8').replace(/\0/g, '').trim();
        offset += nameLen;
        const symbolLen = metaData.readUInt32LE(offset);
        offset += 4;
        symbol = metaData.subarray(offset, offset + symbolLen).toString('utf8').replace(/\0/g, '').trim();
      }

      // Estimate market cap from bonding curve state
      // Price = virtualSolReserves / virtualTokenReserves
      const price = Number(bcInfo.virtualSolReserves) / Number(bcInfo.virtualTokenReserves);
      const tokenSupply = BigInt(1_000_000_000) * BigInt(1e6); // 1B tokens with 6 decimals
      const marketCap = (Number(tokenSupply) / 1e6) * price / 1e9; // in SOL, rough estimate

      return {
        mintAddress: bcInfo.mintAddress,
        name,
        symbol,
        bondingCurveAddress,
        bondingCurveProgress: bcInfo.progress,
        currentMarketCap: marketCap,
        creatorWallet: '', // Would need to query creation tx
        createdAt: new Date(), // Would need creation tx timestamp
        graduated: bcInfo.complete,
        graduatedAt: bcInfo.complete ? new Date() : null,
        raydiumPoolAddress: null,
      };
    } catch (error) {
      logger.debug({ bondingCurveAddress, error }, 'Failed to get token by bonding curve');
      return null;
    }
  }

  // ============================================
  // Public API Methods (if ToS allows)
  // ============================================

  async getNewListings(limit: number = 50): Promise<PumpfunToken[]> {
    if (!this.usePublicApi) {
      logger.warn('Pump.fun public API disabled - using on-chain detection only');
      return [];
    }

    return this.circuitBreaker.execute(async () => {
      await this.rateLimiter.waitForToken();

      try {
        const response = await fetch(
          `${this.apiBaseUrl}/coins?offset=0&limit=${limit}&sort=created_timestamp&order=DESC&includeNsfw=false`
        );

        if (!response.ok) {
          throw new Error(`Pump.fun API error: ${response.status}`);
        }

        const data = await response.json();
        return this.transformApiTokens(data);
      } catch (error) {
        logger.warn({ error }, 'Failed to fetch from pump.fun API');
        return [];
      }
    });
  }

  async getTrending(limit: number = 50): Promise<PumpfunToken[]> {
    if (!this.usePublicApi) {
      return [];
    }

    return this.circuitBreaker.execute(async () => {
      await this.rateLimiter.waitForToken();

      try {
        const response = await fetch(
          `${this.apiBaseUrl}/coins?offset=0&limit=${limit}&sort=market_cap&order=DESC&includeNsfw=false`
        );

        if (!response.ok) {
          throw new Error(`Pump.fun API error: ${response.status}`);
        }

        const data = await response.json();
        return this.transformApiTokens(data);
      } catch (error) {
        logger.warn({ error }, 'Failed to fetch trending from pump.fun API');
        return [];
      }
    });
  }

  async getTokenInfo(mintAddress: string): Promise<PumpfunToken | null> {
    // First try on-chain
    try {
      const [bondingCurve] = PublicKey.findProgramAddressSync(
        [Buffer.from('bonding-curve'), new PublicKey(mintAddress).toBuffer()],
        PROGRAM_IDS.PUMPFUN_PROGRAM
      );
      return this.getTokenByBondingCurve(bondingCurve.toBase58());
    } catch (error) {
      logger.debug({ mintAddress, error }, 'Failed to get pump.fun token info');
      return null;
    }
  }

  async pollNewTokens(since: Date): Promise<PumpfunToken[]> {
    // For on-chain only mode, this would require scanning recent program transactions
    // which is expensive. Recommend using subscriptions instead.
    logger.debug('pollNewTokens: Using subscriptions is recommended for efficiency');
    return this.getNewListings(100);
  }

  private transformApiTokens(apiData: any[]): PumpfunToken[] {
    if (!Array.isArray(apiData)) return [];

    return apiData.map((item) => ({
      mintAddress: item.mint || '',
      name: item.name || 'Unknown',
      symbol: item.symbol || 'UNK',
      bondingCurveAddress: item.bonding_curve || '',
      bondingCurveProgress: item.progress || 0,
      currentMarketCap: item.market_cap || 0,
      creatorWallet: item.creator || '',
      createdAt: new Date(item.created_timestamp || Date.now()),
      graduated: item.complete || false,
      graduatedAt: item.complete ? new Date() : null,
      raydiumPoolAddress: item.raydium_pool || null,
    }));
  }

  // Cleanup
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subId = this.subscriptions.get(subscriptionId);
    if (subId !== undefined) {
      try {
        await this.wsConnection.removeOnLogsListener(subId);
      } catch (error) {
        logger.warn({ subscriptionId, error }, 'Failed to unsubscribe from pump.fun');
      }
      this.subscriptions.delete(subscriptionId);
    }
  }
}
