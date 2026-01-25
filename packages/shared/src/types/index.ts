/**
 * Core Types for Solana Meme Signal Bot
 */

// ============================================
// Base Types
// ============================================

export type SignalMode = 'GENESIS' | 'IGNITION' | 'BOTH';
export type AlertType = 'GENESIS_CANDIDATE' | 'IGNITION_BREAKOUT' | 'RISK_ALERT';
export type ConfidenceBand = 'LOW' | 'MED' | 'HIGH';
export type TokenStatus = 'TRACKING' | 'CANDIDATE' | 'REJECTED' | 'GRADUATED' | 'DEAD';

export interface SolanaAddress {
  address: string;
  isValid(): boolean;
}

// ============================================
// Token Types
// ============================================

export interface TokenInfo {
  mintAddress: string;
  name: string | null;
  symbol: string | null;
  decimals: number;
  supply: bigint;

  // Authorities
  mintAuthority: string | null;
  freezeAuthority: string | null;

  // Metadata
  metadataUri: string | null;
  image: string | null;
  description: string | null;

  // Discovery
  discoveredAt: Date;
  discoverySource: DiscoverySource;
  creatorWallet: string | null;

  // Status
  status: TokenStatus;
}

export type DiscoverySource =
  | 'RAYDIUM_POOL'
  | 'ORCA_POOL'
  | 'METEORA_POOL'
  | 'PUMPFUN_CREATE'
  | 'SPL_MINT'
  | 'DEXSCREENER'
  | 'GECKOTERMINAL'
  | 'MANUAL';

// ============================================
// Pool/Liquidity Types
// ============================================

export interface PoolInfo {
  poolAddress: string;
  dex: DexType;
  tokenMint: string;
  quoteMint: string; // SOL, USDC, etc.

  // Liquidity
  tokenReserve: bigint;
  quoteReserve: bigint;
  liquidityUsd: number;

  // Price
  priceUsd: number | null;
  priceNative: number;

  // Activity
  createdAt: Date;
  firstTradeAt: Date | null;
  lastTradeAt: Date | null;

  // Flags
  isActive: boolean;
  lpBurned: boolean;
  lpLockedUntil: Date | null;
}

export type DexType = 'RAYDIUM' | 'ORCA' | 'METEORA' | 'PUMPFUN' | 'UNKNOWN';

// ============================================
// Trade Types
// ============================================

export interface TradeInfo {
  signature: string;
  poolAddress: string;
  tokenMint: string;

  // Trade details
  side: 'BUY' | 'SELL';
  tokenAmount: bigint;
  quoteAmount: bigint;
  priceUsd: number | null;

  // Trader
  traderWallet: string;

  // Timing
  timestamp: Date;
  slot: number;
}

export interface TradesAggregate {
  tokenMint: string;
  timeframe: Timeframe;
  periodStart: Date;

  // Volume
  buyVolume: bigint;
  sellVolume: bigint;
  totalVolumeUsd: number;

  // Counts
  buyCount: number;
  sellCount: number;
  uniqueTraders: number;

  // Price
  openPrice: number;
  closePrice: number;
  highPrice: number;
  lowPrice: number;
}

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

// ============================================
// Holder Types
// ============================================

export interface HolderSnapshot {
  tokenMint: string;
  timestamp: Date;

  // Holder stats
  totalHolders: number;
  topHoldersPct: number; // Top 10 holders % (excluding LP)

  // Distribution
  holders: HolderInfo[];
}

export interface HolderInfo {
  wallet: string;
  balance: bigint;
  percentage: number;
  isLpAccount: boolean;
  isDexAccount: boolean;
  firstBuySlot: number | null;
}

// ============================================
// Risk/Safety Types
// ============================================

export interface SafetyAnalysis {
  tokenMint: string;
  analyzedAt: Date;

  // Overall verdict
  hardReject: boolean;
  riskScore: number; // 0-100 (higher = riskier)

  // Individual checks
  checks: SafetyCheck[];

  // Explanation
  explanation: string[];
}

export interface SafetyCheck {
  name: string;
  passed: boolean;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  details: string;
  weight: number;
  data?: Record<string, unknown>;
}

export type SafetyCheckType =
  | 'FREEZE_AUTHORITY'
  | 'MINT_AUTHORITY'
  | 'METADATA_VALID'
  | 'LIQUIDITY_MIN'
  | 'HOLDER_CONCENTRATION'
  | 'SNIPER_DETECTION'
  | 'SELLABILITY'
  | 'LP_STATUS'
  | 'CREATOR_HISTORY';

// ============================================
// Momentum Types
// ============================================

export interface MomentumAnalysis {
  tokenMint: string;
  analyzedAt: Date;

  momentumScore: number; // 0-100

  // Components
  volumeVelocity: VelocityMetric;
  tradeVelocity: VelocityMetric;
  traderGrowth: VelocityMetric;
  holderGrowth: VelocityMetric;

  // Patterns
  dipBuyDetected: boolean;
  liquidityStable: boolean;

  // Explanation
  explanation: string[];
}

export interface VelocityMetric {
  name: string;
  current: number;
  previous: number;
  changePercent: number;
  timeframe: Timeframe;
  score: number; // Normalized 0-100
}

// ============================================
// Social Types
// ============================================

export interface SocialAnalysis {
  tokenMint: string;
  analyzedAt: Date;

  socialScore: number; // 0-100
  dataCompleteness: number; // 0-1

  // Per-platform metrics
  telegram: SocialPlatformMetrics | null;
  twitter: SocialPlatformMetrics | null;
  discord: SocialPlatformMetrics | null;

  // Aggregate
  totalMentions: number;
  uniquePosters: number;
  mentionVelocity: number;

  // Flags
  botLikelihood: number; // 0-1
  coordinatedActivity: boolean;

  explanation: string[];
}

export interface SocialPlatformMetrics {
  platform: 'TELEGRAM' | 'TWITTER' | 'DISCORD';
  enabled: boolean;

  mentions: number;
  uniquePosters: number;
  velocity: number; // mentions per hour
  sentiment: number; // -1 to 1

  // Engagement (where available)
  likes: number;
  reposts: number;
  replies: number;
}

// ============================================
// Cross-Verification Types
// ============================================

export interface CrossVerification {
  tokenMint: string;
  verifiedAt: Date;

  // Sources used
  sources: DataSource[];

  // Metrics comparison
  priceDiscrepancy: number; // Max % difference
  volumeDiscrepancy: number;
  liquidityDiscrepancy: number;

  // Confidence adjustment
  confidencePenalty: number; // 0-1, applied if sources disagree

  explanation: string[];
}

export interface DataSource {
  name: string;
  enabled: boolean;
  available: boolean;
  lastFetch: Date | null;

  // Data points
  price: number | null;
  volume24h: number | null;
  liquidity: number | null;
  marketCap: number | null;
}

// ============================================
// Scoring Types
// ============================================

export interface TokenScore {
  tokenMint: string;
  scoredAt: Date;
  mode: SignalMode;

  // Primary scores
  survivalScore: number; // 0-100
  runnerScore: number; // 0-100

  // Data quality
  dataCompleteness: number; // 0-1
  confidenceBand: ConfidenceBand;

  // Component breakdown
  safetyComponent: number;
  momentumComponent: number;
  socialComponent: number;
  verificationComponent: number;

  // Flags
  isCandidate: boolean;
  hardRejected: boolean;

  // Human-readable
  explanation: string[];
  redFlags: string[];
  greenFlags: string[];
}

// ============================================
// Alert Types
// ============================================

export interface Alert {
  id: string;
  type: AlertType;
  tokenMint: string;

  // Scores at time of alert
  survivalScore: number;
  runnerScore: number;
  confidenceBand: ConfidenceBand;

  // Content
  title: string;
  summary: string;
  details: AlertDetails;

  // Status
  createdAt: Date;
  sentAt: Date | null;
  channels: AlertChannel[];
}

export interface AlertDetails {
  tokenName: string | null;
  tokenSymbol: string | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;

  // Key metrics
  keyMetrics: Record<string, string | number>;

  // Explanation
  explanation: string[];
  redFlags: string[];
  greenFlags: string[];

  // Links
  dexscreenerUrl: string | null;
  birdeyeUrl: string | null;
  solscanUrl: string;
}

export interface AlertChannel {
  type: 'DISCORD_WEBHOOK' | 'TELEGRAM' | 'GENERIC_WEBHOOK';
  sent: boolean;
  error: string | null;
}

// ============================================
// Pump.fun Specific Types
// ============================================

export interface PumpfunToken {
  mintAddress: string;
  name: string;
  symbol: string;

  // Bonding curve
  bondingCurveAddress: string;
  bondingCurveProgress: number; // 0-100
  currentMarketCap: number;

  // Creator
  creatorWallet: string;
  createdAt: Date;

  // Status
  graduated: boolean;
  graduatedAt: Date | null;
  raydiumPoolAddress: string | null;
}

// ============================================
// Blacklist Types
// ============================================

export interface BlacklistEntry {
  address: string;
  type: 'WALLET' | 'MINT';
  reason: string;
  addedAt: Date;
  source: 'MANUAL' | 'AUTO_DETECTED' | 'COMMUNITY';
}

// ============================================
// Config Types
// ============================================

export interface ScoringConfig {
  mode: SignalMode;

  // Thresholds
  genesisThresholds: {
    survivalMin: number;
    runnerMin: number;
  };
  ignitionThresholds: {
    survivalMin: number;
    runnerMin: number;
  };
  hardRejectSurvival: number;

  // Weights
  weights: {
    safety: number;
    momentum: number;
    social: number;
    verification: number;
  };

  // Safety config
  safety: {
    rejectFreezeAuthority: boolean;
    rejectMintAuthority: boolean;
    minLiquiditySol: number;
    maxTopHolderPct: number;
  };
}

export interface ProviderConfig {
  // RPC
  solanaRpcHttp: string;
  solanaRpcWs: string;
  heliusApiKey: string | null;

  // Market data
  dexscreenerEnabled: boolean;
  geckoterminalEnabled: boolean;
  birdeyeApiKey: string | null;
  jupiterEnabled: boolean;

  // Social
  telegramBotToken: string | null;
  telegramChatIds: string[];
  twitterApiKey: string | null;
  discordBotToken: string | null;
  discordChannelIds: string[];

  // Alerting
  discordWebhookUrl: string | null;

  // DEX
  enableRaydium: boolean;
  enableOrca: boolean;
  enableMeteora: boolean;
  enablePumpfun: boolean;

  // Rate limits
  rpcRateLimit: number;
  dexscreenerRateLimit: number;
  geckoterminalRateLimit: number;
  jupiterRateLimit: number;
}
