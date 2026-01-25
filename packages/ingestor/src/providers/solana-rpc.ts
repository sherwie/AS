/**
 * Solana RPC Chain Provider
 * Works with public RPC (default) or Helius (enhanced)
 */

import {
  Connection,
  PublicKey,
  AccountInfo,
  ParsedAccountData,
  Commitment,
  LogsFilter,
  Context,
} from '@solana/web3.js';
import {
  IChainProvider,
  ProviderStatus,
  TokenMetadata,
  TokenAuthorities,
  TokenAccountInfo,
  MintEvent,
  PoolEvent,
  TradeEvent,
  createLogger,
  RateLimiter,
  CircuitBreaker,
  withRetry,
  isNetworkError,
  PROGRAM_IDS,
  DexType,
} from '@solana-signal/shared';

const logger = createLogger('solana-rpc');

interface SubscriptionCallback<T> {
  callback: (event: T) => void;
  filter?: LogsFilter;
}

export class SolanaRpcProvider implements IChainProvider {
  readonly name = 'solana-rpc';

  private httpConnection: Connection;
  private wsConnection: Connection;
  private isInitialized = false;
  private subscriptions: Map<string, number> = new Map();
  private mintCallbacks: Map<string, SubscriptionCallback<MintEvent>> = new Map();
  private poolCallbacks: Map<string, SubscriptionCallback<PoolEvent>> = new Map();
  private tradeCallbacks: Map<string, SubscriptionCallback<TradeEvent>> = new Map();

  private rateLimiter: RateLimiter;
  private circuitBreaker: CircuitBreaker;
  private lastHealthCheck: Date | null = null;
  private lastError: string | null = null;
  private hasHelius: boolean;

  constructor(
    httpUrl: string,
    wsUrl: string,
    rateLimiter: RateLimiter,
    circuitBreaker: CircuitBreaker
  ) {
    this.httpConnection = new Connection(httpUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
    this.wsConnection = new Connection(wsUrl, {
      commitment: 'confirmed',
      wsEndpoint: wsUrl,
    });
    this.rateLimiter = rateLimiter;
    this.circuitBreaker = circuitBreaker;
    this.hasHelius = httpUrl.includes('helius');
  }

  async connect(): Promise<void> {
    try {
      // Test connection
      const slot = await this.httpConnection.getSlot();
      logger.info({ slot, hasHelius: this.hasHelius }, 'Connected to Solana RPC');
      this.isInitialized = true;
      this.lastHealthCheck = new Date();
    } catch (error) {
      this.lastError = (error as Error).message;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // Unsubscribe from all
    for (const [id, subId] of this.subscriptions) {
      try {
        await this.wsConnection.removeOnLogsListener(subId);
      } catch (e) {
        logger.warn({ id, error: e }, 'Failed to remove subscription');
      }
    }
    this.subscriptions.clear();
    this.isInitialized = false;
  }

  isConnected(): boolean {
    return this.isInitialized;
  }

  getStatus(): ProviderStatus {
    return {
      name: this.name,
      enabled: true,
      available: this.isInitialized && this.circuitBreaker.canExecute(),
      requiresApiKey: false,
      hasApiKey: this.hasHelius,
      lastHealthCheck: this.lastHealthCheck,
      lastError: this.lastError,
      requestsRemaining: this.rateLimiter.getAvailableTokens(),
    };
  }

  // ============================================
  // Token Operations
  // ============================================

  async getTokenInfo(mintAddress: string): Promise<TokenInfo | null> {
    return this.circuitBreaker.execute(async () => {
      await this.rateLimiter.waitForToken();

      const mintPubkey = new PublicKey(mintAddress);
      const accountInfo = await withRetry(
        () => this.httpConnection.getParsedAccountInfo(mintPubkey),
        { retryableErrors: isNetworkError }
      );

      if (!accountInfo.value) return null;

      const data = accountInfo.value.data;
      if (!('parsed' in data)) return null;

      const parsed = data.parsed;
      if (parsed.type !== 'mint') return null;

      const info = parsed.info;
      return {
        mintAddress,
        decimals: info.decimals,
        supply: BigInt(info.supply),
        mintAuthority: info.mintAuthority || null,
        freezeAuthority: info.freezeAuthority || null,
      };
    });
  }

  async getTokenMetadata(mintAddress: string): Promise<TokenMetadata | null> {
    return this.circuitBreaker.execute(async () => {
      await this.rateLimiter.waitForToken();

      try {
        const mintPubkey = new PublicKey(mintAddress);
        const [metadataAddress] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('metadata'),
            PROGRAM_IDS.METAPLEX_TOKEN_METADATA.toBuffer(),
            mintPubkey.toBuffer(),
          ],
          PROGRAM_IDS.METAPLEX_TOKEN_METADATA
        );

        const accountInfo = await withRetry(
          () => this.httpConnection.getAccountInfo(metadataAddress),
          { retryableErrors: isNetworkError }
        );

        if (!accountInfo) return null;

        // Parse Metaplex metadata (simplified parsing)
        const data = accountInfo.data;
        const metadata = this.parseMetaplexMetadata(data);
        return metadata;
      } catch (error) {
        logger.debug({ mintAddress, error }, 'Failed to fetch metadata');
        return null;
      }
    });
  }

  private parseMetaplexMetadata(data: Buffer): TokenMetadata {
    // Simplified Metaplex metadata parsing
    // In production, use @metaplex-foundation/mpl-token-metadata for full parsing
    try {
      // Skip the first byte (key) and parse remaining data
      let offset = 1;

      // Skip update authority (32 bytes)
      offset += 32;

      // Skip mint (32 bytes)
      offset += 32;

      // Read name (4 bytes length + string)
      const nameLength = data.readUInt32LE(offset);
      offset += 4;
      const name = data.subarray(offset, offset + nameLength).toString('utf8').replace(/\0/g, '').trim();
      offset += nameLength;

      // Read symbol (4 bytes length + string)
      const symbolLength = data.readUInt32LE(offset);
      offset += 4;
      const symbol = data.subarray(offset, offset + symbolLength).toString('utf8').replace(/\0/g, '').trim();
      offset += symbolLength;

      // Read URI (4 bytes length + string)
      const uriLength = data.readUInt32LE(offset);
      offset += 4;
      const uri = data.subarray(offset, offset + uriLength).toString('utf8').replace(/\0/g, '').trim();

      return {
        name: name || null,
        symbol: symbol || null,
        uri: uri || null,
        image: null,
        description: null,
        sellerFeeBasisPoints: null,
        creators: null,
      };
    } catch (error) {
      logger.debug({ error }, 'Failed to parse Metaplex metadata');
      return {
        name: null,
        symbol: null,
        uri: null,
        image: null,
        description: null,
        sellerFeeBasisPoints: null,
        creators: null,
      };
    }
  }

  async getTokenAuthorities(mintAddress: string): Promise<TokenAuthorities> {
    const info = await this.getTokenInfo(mintAddress);
    return {
      mintAuthority: info?.mintAuthority || null,
      freezeAuthority: info?.freezeAuthority || null,
      updateAuthority: null, // Would need metadata fetch
    };
  }

  async getTokenAccounts(
    mintAddress: string,
    limit: number = 100
  ): Promise<TokenAccountInfo[]> {
    return this.circuitBreaker.execute(async () => {
      await this.rateLimiter.waitForToken();

      const mintPubkey = new PublicKey(mintAddress);
      const accounts = await withRetry(
        () =>
          this.httpConnection.getParsedProgramAccounts(PROGRAM_IDS.TOKEN_PROGRAM, {
            filters: [
              { dataSize: 165 },
              { memcmp: { offset: 0, bytes: mintPubkey.toBase58() } },
            ],
          }),
        { retryableErrors: isNetworkError }
      );

      return accounts
        .map((account) => {
          const data = account.account.data;
          if (!('parsed' in data)) return null;

          const info = data.parsed.info;
          return {
            address: account.pubkey.toBase58(),
            owner: info.owner,
            mint: info.mint,
            balance: BigInt(info.tokenAmount.amount),
            isLpAccount: this.isLpAccount(info.owner),
            isDexAccount: this.isDexAccount(info.owner),
          };
        })
        .filter((a): a is TokenAccountInfo => a !== null)
        .sort((a, b) => (b.balance > a.balance ? 1 : -1))
        .slice(0, limit);
    });
  }

  private isLpAccount(owner: string): boolean {
    // Check if owner is a known LP/DEX program
    const lpPrograms = [
      PROGRAM_IDS.RAYDIUM_AMM_V4.toBase58(),
      PROGRAM_IDS.RAYDIUM_CLMM.toBase58(),
      PROGRAM_IDS.ORCA_WHIRLPOOL.toBase58(),
      PROGRAM_IDS.METEORA_DLMM.toBase58(),
      PROGRAM_IDS.METEORA_POOLS.toBase58(),
    ];
    return lpPrograms.includes(owner);
  }

  private isDexAccount(owner: string): boolean {
    return this.isLpAccount(owner);
  }

  async getAccountBalance(address: string, mintAddress: string): Promise<bigint> {
    return this.circuitBreaker.execute(async () => {
      await this.rateLimiter.waitForToken();

      const accounts = await this.getTokenAccounts(mintAddress, 1000);
      const account = accounts.find((a) => a.address === address);
      return account?.balance || BigInt(0);
    });
  }

  // ============================================
  // Subscriptions
  // ============================================

  async subscribeToMints(callback: (mint: MintEvent) => void): Promise<string> {
    const subscriptionId = `mint:${Date.now()}`;

    // Subscribe to Token Program logs for InitializeMint
    const subId = this.wsConnection.onLogs(
      PROGRAM_IDS.TOKEN_PROGRAM,
      (logs, context) => {
        this.processMintLogs(logs, context, callback);
      },
      'confirmed'
    );

    this.subscriptions.set(subscriptionId, subId);
    this.mintCallbacks.set(subscriptionId, { callback });

    logger.info({ subscriptionId }, 'Subscribed to mint events');
    return subscriptionId;
  }

  private processMintLogs(
    logs: { signature: string; logs: string[]; err: unknown },
    context: Context,
    callback: (event: MintEvent) => void
  ): void {
    // Check if this is an InitializeMint instruction
    const hasInitMint = logs.logs.some(
      (log) =>
        log.includes('InitializeMint') ||
        log.includes('Instruction: InitializeMint2')
    );

    if (!hasInitMint || logs.err) return;

    // For full parsing, we'd need to fetch and decode the transaction
    // This is a simplified version - in production, fetch full tx details
    logger.debug({ signature: logs.signature }, 'Detected potential new mint');

    // Queue for detailed processing
    this.fetchAndProcessMint(logs.signature, context.slot, callback);
  }

  private async fetchAndProcessMint(
    signature: string,
    slot: number,
    callback: (event: MintEvent) => void
  ): Promise<void> {
    try {
      await this.rateLimiter.waitForToken();

      const tx = await this.httpConnection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx?.meta || tx.meta.err) return;

      // Find InitializeMint instruction
      const instructions = tx.transaction.message.instructions;
      for (const ix of instructions) {
        if ('parsed' in ix && ix.parsed?.type === 'initializeMint') {
          const info = ix.parsed.info;
          const event: MintEvent = {
            signature,
            mintAddress: info.mint,
            mintAuthority: info.mintAuthority || null,
            freezeAuthority: info.freezeAuthority || null,
            decimals: info.decimals,
            supply: BigInt(0),
            timestamp: new Date((tx.blockTime || Date.now() / 1000) * 1000),
            slot,
          };

          callback(event);
          return;
        }
      }
    } catch (error) {
      logger.debug({ signature, error }, 'Failed to process mint transaction');
    }
  }

  async subscribeToPools(
    dex: DexType,
    callback: (pool: PoolEvent) => void
  ): Promise<string> {
    const programId = this.getDexProgramId(dex);
    if (!programId) {
      throw new Error(`Unsupported DEX: ${dex}`);
    }

    const subscriptionId = `pool:${dex}:${Date.now()}`;

    const subId = this.wsConnection.onLogs(
      programId,
      (logs, context) => {
        this.processPoolLogs(logs, context, dex, callback);
      },
      'confirmed'
    );

    this.subscriptions.set(subscriptionId, subId);
    this.poolCallbacks.set(subscriptionId, { callback });

    logger.info({ subscriptionId, dex }, 'Subscribed to pool events');
    return subscriptionId;
  }

  private getDexProgramId(dex: DexType): PublicKey | null {
    switch (dex) {
      case 'RAYDIUM':
        return PROGRAM_IDS.RAYDIUM_AMM_V4;
      case 'ORCA':
        return PROGRAM_IDS.ORCA_WHIRLPOOL;
      case 'METEORA':
        return PROGRAM_IDS.METEORA_DLMM;
      case 'PUMPFUN':
        return PROGRAM_IDS.PUMPFUN_PROGRAM;
      default:
        return null;
    }
  }

  private processPoolLogs(
    logs: { signature: string; logs: string[]; err: unknown },
    context: Context,
    dex: DexType,
    callback: (event: PoolEvent) => void
  ): void {
    // Check for pool initialization patterns
    const hasPoolInit = logs.logs.some(
      (log) =>
        log.includes('initialize') ||
        log.includes('Initialize') ||
        log.includes('create_pool') ||
        log.includes('CreatePool')
    );

    if (!hasPoolInit || logs.err) return;

    logger.debug({ signature: logs.signature, dex }, 'Detected potential new pool');
    this.fetchAndProcessPool(logs.signature, context.slot, dex, callback);
  }

  private async fetchAndProcessPool(
    signature: string,
    slot: number,
    dex: DexType,
    callback: (event: PoolEvent) => void
  ): Promise<void> {
    try {
      await this.rateLimiter.waitForToken();

      const tx = await this.httpConnection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx?.meta || tx.meta.err) return;

      // Extract pool information based on DEX type
      const poolEvent = this.extractPoolEvent(tx, signature, slot, dex);
      if (poolEvent) {
        callback(poolEvent);
      }
    } catch (error) {
      logger.debug({ signature, dex, error }, 'Failed to process pool transaction');
    }
  }

  private extractPoolEvent(
    tx: any,
    signature: string,
    slot: number,
    dex: DexType
  ): PoolEvent | null {
    // Extract account keys involved
    const accountKeys = tx.transaction.message.accountKeys.map((k: any) =>
      typeof k === 'string' ? k : k.pubkey.toBase58()
    );

    // For Raydium AMM V4, the pool is typically the first writable account
    // This is simplified - production should decode instruction data
    const postTokenBalances = tx.meta?.postTokenBalances || [];

    if (postTokenBalances.length < 2) return null;

    // Find token accounts that received initial liquidity
    const tokenAccounts = postTokenBalances.filter(
      (b: any) => b.uiTokenAmount.uiAmount > 0
    );

    if (tokenAccounts.length < 2) return null;

    // Determine which is the token and which is the quote
    const mints = tokenAccounts.map((t: any) => t.mint);
    const solMint = PROGRAM_IDS.WRAPPED_SOL.toBase58();
    const usdcMint = PROGRAM_IDS.USDC.toBase58();

    let tokenMint: string;
    let quoteMint: string;

    if (mints.includes(solMint)) {
      quoteMint = solMint;
      tokenMint = mints.find((m: string) => m !== solMint) || mints[0];
    } else if (mints.includes(usdcMint)) {
      quoteMint = usdcMint;
      tokenMint = mints.find((m: string) => m !== usdcMint) || mints[0];
    } else {
      // Both are unknown tokens, skip
      return null;
    }

    // Find pool address (first account that's not a token or known program)
    const poolAddress = accountKeys.find(
      (k: string) =>
        !mints.includes(k) &&
        k !== PROGRAM_IDS.RAYDIUM_AMM_V4.toBase58() &&
        k !== PROGRAM_IDS.TOKEN_PROGRAM.toBase58()
    );

    if (!poolAddress) return null;

    const tokenAccount = tokenAccounts.find((t: any) => t.mint === tokenMint);
    const quoteAccount = tokenAccounts.find((t: any) => t.mint === quoteMint);

    return {
      signature,
      poolAddress,
      dex,
      tokenMint,
      quoteMint,
      initialTokenReserve: BigInt(tokenAccount?.uiTokenAmount.amount || '0'),
      initialQuoteReserve: BigInt(quoteAccount?.uiTokenAmount.amount || '0'),
      timestamp: new Date((tx.blockTime || Date.now() / 1000) * 1000),
      slot,
    };
  }

  async subscribeToTrades(
    poolAddress: string,
    callback: (trade: TradeEvent) => void
  ): Promise<string> {
    const subscriptionId = `trade:${poolAddress}:${Date.now()}`;
    const poolPubkey = new PublicKey(poolAddress);

    const subId = this.wsConnection.onLogs(
      poolPubkey,
      (logs, context) => {
        this.processTradeLog(logs, context, poolAddress, callback);
      },
      'confirmed'
    );

    this.subscriptions.set(subscriptionId, subId);
    this.tradeCallbacks.set(subscriptionId, { callback });

    logger.debug({ subscriptionId, poolAddress }, 'Subscribed to trade events');
    return subscriptionId;
  }

  private processTradeLog(
    logs: { signature: string; logs: string[]; err: unknown },
    context: Context,
    poolAddress: string,
    callback: (event: TradeEvent) => void
  ): void {
    // Check for swap/trade patterns
    const hasSwap = logs.logs.some(
      (log) =>
        log.includes('swap') ||
        log.includes('Swap') ||
        log.includes('ray_log')
    );

    if (!hasSwap || logs.err) return;

    this.fetchAndProcessTrade(logs.signature, context.slot, poolAddress, callback);
  }

  private async fetchAndProcessTrade(
    signature: string,
    slot: number,
    poolAddress: string,
    callback: (event: TradeEvent) => void
  ): Promise<void> {
    try {
      await this.rateLimiter.waitForToken();

      const tx = await this.httpConnection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx?.meta || tx.meta.err) return;

      // Analyze token balance changes to determine trade direction and amounts
      const preBalances = tx.meta.preTokenBalances || [];
      const postBalances = tx.meta.postTokenBalances || [];

      // Find the trader's token balance changes
      // This is simplified - production should handle edge cases
      const changes = this.calculateBalanceChanges(preBalances, postBalances);

      if (changes.length < 2) return;

      // Determine trade direction and amounts
      const solChange = changes.find((c) => c.mint === PROGRAM_IDS.WRAPPED_SOL.toBase58());
      const tokenChange = changes.find((c) => c.mint !== PROGRAM_IDS.WRAPPED_SOL.toBase58());

      if (!solChange || !tokenChange) return;

      const side: 'BUY' | 'SELL' = tokenChange.change > 0 ? 'BUY' : 'SELL';

      const event: TradeEvent = {
        signature,
        poolAddress,
        tokenMint: tokenChange.mint,
        side,
        tokenAmount: BigInt(Math.abs(tokenChange.change)),
        quoteAmount: BigInt(Math.abs(solChange.change)),
        traderWallet: tokenChange.owner,
        timestamp: new Date((tx.blockTime || Date.now() / 1000) * 1000),
        slot,
      };

      callback(event);
    } catch (error) {
      logger.debug({ signature, error }, 'Failed to process trade transaction');
    }
  }

  private calculateBalanceChanges(
    preBalances: any[],
    postBalances: any[]
  ): Array<{ mint: string; owner: string; change: number }> {
    const changes: Array<{ mint: string; owner: string; change: number }> = [];

    for (const post of postBalances) {
      const pre = preBalances.find(
        (p) => p.accountIndex === post.accountIndex
      );

      const preAmount = pre ? Number(pre.uiTokenAmount.amount) : 0;
      const postAmount = Number(post.uiTokenAmount.amount);
      const change = postAmount - preAmount;

      if (change !== 0) {
        changes.push({
          mint: post.mint,
          owner: post.owner,
          change,
        });
      }
    }

    return changes;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const subId = this.subscriptions.get(subscriptionId);
    if (subId !== undefined) {
      try {
        await this.wsConnection.removeOnLogsListener(subId);
      } catch (error) {
        logger.warn({ subscriptionId, error }, 'Failed to unsubscribe');
      }
      this.subscriptions.delete(subscriptionId);
      this.mintCallbacks.delete(subscriptionId);
      this.poolCallbacks.delete(subscriptionId);
      this.tradeCallbacks.delete(subscriptionId);
    }
  }

  // ============================================
  // Polling Fallbacks
  // ============================================

  async getRecentMints(since: Date, limit: number = 100): Promise<MintEvent[]> {
    // This would require signature scanning which is expensive
    // For public RPC, recommend using WebSocket subscriptions instead
    logger.warn('getRecentMints polling is expensive - prefer WebSocket subscriptions');
    return [];
  }

  async getRecentPools(
    dex: DexType,
    since: Date,
    limit: number = 100
  ): Promise<PoolEvent[]> {
    // Similar to mints - expensive for public RPC
    logger.warn('getRecentPools polling is expensive - prefer WebSocket subscriptions');
    return [];
  }

  async getRecentTrades(
    poolAddress: string,
    since: Date,
    limit: number = 100
  ): Promise<TradeEvent[]> {
    // Could use getSignaturesForAddress but expensive
    logger.warn('getRecentTrades polling is expensive - prefer WebSocket subscriptions');
    return [];
  }
}

interface TokenInfo {
  mintAddress: string;
  decimals: number;
  supply: bigint;
  mintAuthority: string | null;
  freezeAuthority: string | null;
}
