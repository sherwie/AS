/**
 * Core Interfaces for Solana Meme Signal Bot
 * All providers and engines implement these interfaces for swappability
 */

import {
  TokenInfo,
  PoolInfo,
  TradeInfo,
  HolderSnapshot,
  SafetyAnalysis,
  MomentumAnalysis,
  SocialAnalysis,
  CrossVerification,
  TokenScore,
  Alert,
  PumpfunToken,
  ScoringConfig,
  ProviderConfig,
  DexType,
  Timeframe,
} from '../types/index.js';

// ============================================
// Provider Status
// ============================================

export interface ProviderStatus {
  name: string;
  enabled: boolean;
  available: boolean;
  requiresApiKey: boolean;
  hasApiKey: boolean;
  lastHealthCheck: Date | null;
  lastError: string | null;
  requestsRemaining: number | null;
}

// ============================================
// Chain Provider Interface
// ============================================

export interface IChainProvider {
  readonly name: string;

  // Connection
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getStatus(): ProviderStatus;

  // Token operations
  getTokenInfo(mintAddress: string): Promise<TokenInfo | null>;
  getTokenMetadata(mintAddress: string): Promise<TokenMetadata | null>;
  getTokenAuthorities(mintAddress: string): Promise<TokenAuthorities>;

  // Account operations
  getTokenAccounts(
    mintAddress: string,
    limit?: number
  ): Promise<TokenAccountInfo[]>;
  getAccountBalance(address: string, mintAddress: string): Promise<bigint>;

  // Subscription (WebSocket)
  subscribeToMints(callback: (mint: MintEvent) => void): Promise<string>;
  subscribeToPools(
    dex: DexType,
    callback: (pool: PoolEvent) => void
  ): Promise<string>;
  subscribeToTrades(
    poolAddress: string,
    callback: (trade: TradeEvent) => void
  ): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;

  // Polling fallback
  getRecentMints(since: Date, limit?: number): Promise<MintEvent[]>;
  getRecentPools(dex: DexType, since: Date, limit?: number): Promise<PoolEvent[]>;
  getRecentTrades(
    poolAddress: string,
    since: Date,
    limit?: number
  ): Promise<TradeEvent[]>;
}

export interface TokenMetadata {
  name: string | null;
  symbol: string | null;
  uri: string | null;
  image: string | null;
  description: string | null;
  sellerFeeBasisPoints: number | null;
  creators: MetadataCreator[] | null;
}

export interface MetadataCreator {
  address: string;
  verified: boolean;
  share: number;
}

export interface TokenAuthorities {
  mintAuthority: string | null;
  freezeAuthority: string | null;
  updateAuthority: string | null;
}

export interface TokenAccountInfo {
  address: string;
  owner: string;
  mint: string;
  balance: bigint;
  isLpAccount: boolean;
  isDexAccount: boolean;
}

export interface MintEvent {
  signature: string;
  mintAddress: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  decimals: number;
  supply: bigint;
  timestamp: Date;
  slot: number;
}

export interface PoolEvent {
  signature: string;
  poolAddress: string;
  dex: DexType;
  tokenMint: string;
  quoteMint: string;
  initialTokenReserve: bigint;
  initialQuoteReserve: bigint;
  timestamp: Date;
  slot: number;
}

export interface TradeEvent {
  signature: string;
  poolAddress: string;
  tokenMint: string;
  side: 'BUY' | 'SELL';
  tokenAmount: bigint;
  quoteAmount: bigint;
  traderWallet: string;
  timestamp: Date;
  slot: number;
}

// ============================================
// Pump.fun Provider Interface
// ============================================

export interface IPumpfunProvider {
  readonly name: string;
  getStatus(): ProviderStatus;

  // On-chain detection
  subscribeToBondingCurves(
    callback: (event: PumpfunEvent) => void
  ): Promise<string>;
  getBondingCurveInfo(
    bondingCurveAddress: string
  ): Promise<PumpfunBondingCurve | null>;
  getTokenByBondingCurve(
    bondingCurveAddress: string
  ): Promise<PumpfunToken | null>;

  // Public API (if available)
  getNewListings(limit?: number): Promise<PumpfunToken[]>;
  getTrending(limit?: number): Promise<PumpfunToken[]>;
  getTokenInfo(mintAddress: string): Promise<PumpfunToken | null>;

  // Polling
  pollNewTokens(since: Date): Promise<PumpfunToken[]>;
}

export interface PumpfunEvent {
  type: 'CREATE' | 'BUY' | 'SELL' | 'GRADUATE';
  signature: string;
  mintAddress: string;
  bondingCurveAddress: string;
  timestamp: Date;
  slot: number;

  // For trades
  tokenAmount?: bigint;
  solAmount?: bigint;
  traderWallet?: string;

  // For graduation
  raydiumPoolAddress?: string;
}

export interface PumpfunBondingCurve {
  address: string;
  mintAddress: string;
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolReserves: bigint;
  progress: number; // 0-100
  complete: boolean;
}

// ============================================
// Market Data Provider Interface
// ============================================

export interface IMarketDataProvider {
  readonly name: string;
  getStatus(): ProviderStatus;

  // Token data
  getTokenPrice(mintAddress: string): Promise<PriceData | null>;
  getTokenPriceHistory(
    mintAddress: string,
    timeframe: Timeframe,
    limit?: number
  ): Promise<PriceCandle[]>;

  // Pool data
  getPoolInfo(poolAddress: string): Promise<PoolData | null>;
  getPoolsByToken(mintAddress: string): Promise<PoolData[]>;

  // Volume/liquidity
  getVolume24h(mintAddress: string): Promise<number | null>;
  getLiquidity(mintAddress: string): Promise<number | null>;

  // Search
  searchToken(query: string): Promise<TokenSearchResult[]>;
  getNewPairs(since: Date, limit?: number): Promise<PoolData[]>;
}

export interface PriceData {
  mintAddress: string;
  priceUsd: number;
  priceNative: number;
  change1h: number | null;
  change24h: number | null;
  volume24h: number | null;
  liquidity: number | null;
  marketCap: number | null;
  fdv: number | null;
  timestamp: Date;
}

export interface PriceCandle {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PoolData {
  poolAddress: string;
  dex: string;
  tokenMint: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  quoteMint: string;
  quoteSymbol: string;
  priceUsd: number | null;
  priceNative: number;
  liquidity: number;
  volume24h: number;
  txns24h: number;
  createdAt: Date;
  url: string | null;
}

export interface TokenSearchResult {
  mintAddress: string;
  name: string | null;
  symbol: string | null;
  priceUsd: number | null;
  volume24h: number | null;
  liquidity: number | null;
}

// ============================================
// Social Provider Interface
// ============================================

export interface ISocialProvider {
  readonly name: string;
  readonly platform: 'TELEGRAM' | 'TWITTER' | 'DISCORD' | 'GENERIC';
  getStatus(): ProviderStatus;

  // Connection
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // Monitoring
  subscribeToMentions(
    patterns: MentionPattern[],
    callback: (mention: SocialMention) => void
  ): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;

  // Search/polling
  searchMentions(
    query: string,
    since: Date,
    limit?: number
  ): Promise<SocialMention[]>;
  getMentionsByToken(
    mintAddress: string,
    since: Date,
    limit?: number
  ): Promise<SocialMention[]>;

  // Metrics
  getMentionVelocity(
    mintAddress: string,
    timeframe: Timeframe
  ): Promise<number>;
  getUniquePosters(mintAddress: string, since: Date): Promise<number>;
}

export interface MentionPattern {
  type: 'CONTRACT_ADDRESS' | 'TICKER' | 'KEYWORD';
  value: string;
}

export interface SocialMention {
  id: string;
  platform: 'TELEGRAM' | 'TWITTER' | 'DISCORD';

  // Content
  text: string;
  authorId: string;
  authorName: string | null;

  // Matching
  matchedMint: string | null;
  matchedTicker: string | null;
  matchType: 'CONTRACT_ADDRESS' | 'TICKER' | 'KEYWORD';

  // Engagement
  likes: number;
  reposts: number;
  replies: number;

  // Metadata
  timestamp: Date;
  channelId: string | null;
  channelName: string | null;
  messageUrl: string | null;

  // Analysis
  sentiment: number; // -1 to 1
  isBot: boolean;
}

// ============================================
// Risk Engine Interface
// ============================================

export interface IRiskEngine {
  analyze(mintAddress: string): Promise<SafetyAnalysis>;

  // Individual checks
  checkFreezeAuthority(mintAddress: string): Promise<SafetyCheckResult>;
  checkMintAuthority(mintAddress: string): Promise<SafetyCheckResult>;
  checkMetadata(mintAddress: string): Promise<SafetyCheckResult>;
  checkLiquidity(mintAddress: string): Promise<SafetyCheckResult>;
  checkHolderConcentration(mintAddress: string): Promise<SafetyCheckResult>;
  checkSniperActivity(mintAddress: string): Promise<SafetyCheckResult>;
  checkSellability(mintAddress: string): Promise<SafetyCheckResult>;
  checkLpStatus(mintAddress: string): Promise<SafetyCheckResult>;
  checkCreatorHistory(creatorWallet: string): Promise<SafetyCheckResult>;
}

export interface SafetyCheckResult {
  name: string;
  passed: boolean;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  details: string;
  data: Record<string, unknown>;
}

// ============================================
// Momentum Engine Interface
// ============================================

export interface IMomentumEngine {
  analyze(mintAddress: string): Promise<MomentumAnalysis>;

  // Individual metrics
  getVolumeVelocity(
    mintAddress: string,
    timeframe: Timeframe
  ): Promise<VelocityResult>;
  getTradeVelocity(
    mintAddress: string,
    timeframe: Timeframe
  ): Promise<VelocityResult>;
  getTraderGrowth(
    mintAddress: string,
    timeframe: Timeframe
  ): Promise<VelocityResult>;
  getHolderGrowth(
    mintAddress: string,
    timeframe: Timeframe
  ): Promise<VelocityResult>;

  // Pattern detection
  detectDipBuy(mintAddress: string): Promise<PatternResult>;
  checkLiquidityStability(mintAddress: string): Promise<PatternResult>;
}

export interface VelocityResult {
  name: string;
  current: number;
  previous: number;
  changePercent: number;
  score: number; // Normalized 0-100
}

export interface PatternResult {
  detected: boolean;
  confidence: number;
  details: string;
  data: Record<string, unknown>;
}

// ============================================
// Scoring Engine Interface
// ============================================

export interface IScoringEngine {
  score(mintAddress: string): Promise<TokenScore>;

  // Component scoring
  calculateSurvivalScore(safety: SafetyAnalysis): number;
  calculateRunnerScore(
    momentum: MomentumAnalysis,
    social: SocialAnalysis | null,
    verification: CrossVerification
  ): number;

  // Confidence
  calculateDataCompleteness(
    safety: SafetyAnalysis,
    momentum: MomentumAnalysis,
    social: SocialAnalysis | null,
    verification: CrossVerification
  ): number;
  determineConfidenceBand(dataCompleteness: number): 'LOW' | 'MED' | 'HIGH';

  // Config
  getConfig(): ScoringConfig;
  updateConfig(config: Partial<ScoringConfig>): void;
}

// ============================================
// Cross-Verification Engine Interface
// ============================================

export interface ICrossVerificationEngine {
  verify(mintAddress: string): Promise<CrossVerification>;

  // Per-source fetch
  fetchFromDexScreener(mintAddress: string): Promise<SourceData | null>;
  fetchFromGeckoTerminal(mintAddress: string): Promise<SourceData | null>;
  fetchFromBirdeye(mintAddress: string): Promise<SourceData | null>;
  fetchFromChain(mintAddress: string): Promise<SourceData | null>;

  // Comparison
  compareMetrics(sources: SourceData[]): MetricComparison;
  calculateConfidencePenalty(comparison: MetricComparison): number;
}

export interface SourceData {
  name: string;
  timestamp: Date;
  price: number | null;
  volume24h: number | null;
  liquidity: number | null;
  marketCap: number | null;
}

export interface MetricComparison {
  priceDiscrepancy: number;
  volumeDiscrepancy: number;
  liquidityDiscrepancy: number;
  sourcesUsed: number;
  sourcesAvailable: number;
}

// ============================================
// Alerting Interface
// ============================================

export interface IAlertChannel {
  readonly name: string;
  readonly type: 'DISCORD_WEBHOOK' | 'TELEGRAM' | 'GENERIC_WEBHOOK';
  getStatus(): ProviderStatus;

  send(alert: Alert): Promise<AlertSendResult>;
  formatAlert(alert: Alert): unknown; // Platform-specific format
  testConnection(): Promise<boolean>;
}

export interface AlertSendResult {
  success: boolean;
  error: string | null;
  messageId: string | null;
  timestamp: Date;
}

// ============================================
// Queue/Job Interfaces
// ============================================

export interface IJobProcessor<T, R> {
  process(data: T): Promise<R>;
}

export interface JobPayload {
  type: string;
  data: unknown;
  priority?: number;
  attempts?: number;
  delay?: number;
}

// ============================================
// Health/Metrics Interface
// ============================================

export interface IHealthCheck {
  check(): Promise<HealthStatus>;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: ComponentHealth[];
  timestamp: Date;
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number | null;
  message: string | null;
}

export interface IMetricsCollector {
  increment(name: string, value?: number, tags?: Record<string, string>): void;
  gauge(name: string, value: number, tags?: Record<string, string>): void;
  histogram(name: string, value: number, tags?: Record<string, string>): void;
  timing(name: string, value: number, tags?: Record<string, string>): void;
  getMetrics(): string; // Prometheus format
}
