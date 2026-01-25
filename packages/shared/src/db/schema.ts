/**
 * Database Schema using Drizzle ORM
 */

import {
  pgTable,
  varchar,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  real,
  jsonb,
  index,
  unique,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// Tokens Table
// ============================================

export const tokens = pgTable(
  'tokens',
  {
    mintAddress: varchar('mint_address', { length: 44 }).primaryKey(),
    name: varchar('name', { length: 255 }),
    symbol: varchar('symbol', { length: 32 }),
    decimals: integer('decimals').notNull().default(9),
    supply: bigint('supply', { mode: 'bigint' }),

    // Authorities
    mintAuthority: varchar('mint_authority', { length: 44 }),
    freezeAuthority: varchar('freeze_authority', { length: 44 }),

    // Metadata
    metadataUri: text('metadata_uri'),
    image: text('image'),
    description: text('description'),

    // Discovery
    discoveredAt: timestamp('discovered_at').notNull().defaultNow(),
    discoverySource: varchar('discovery_source', { length: 32 }).notNull(),
    creatorWallet: varchar('creator_wallet', { length: 44 }),

    // Status
    status: varchar('status', { length: 16 }).notNull().default('TRACKING'),

    // Pump.fun specific
    isPumpfun: boolean('is_pumpfun').notNull().default(false),
    bondingCurveAddress: varchar('bonding_curve_address', { length: 44 }),
    bondingCurveProgress: real('bonding_curve_progress'),
    graduatedAt: timestamp('graduated_at'),
    graduatedPoolAddress: varchar('graduated_pool_address', { length: 44 }),

    // Timestamps
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => ({
    statusIdx: index('tokens_status_idx').on(table.status),
    discoveredAtIdx: index('tokens_discovered_at_idx').on(table.discoveredAt),
    creatorWalletIdx: index('tokens_creator_wallet_idx').on(table.creatorWallet),
    isPumpfunIdx: index('tokens_is_pumpfun_idx').on(table.isPumpfun),
  })
);

// ============================================
// Pools Table
// ============================================

export const pools = pgTable(
  'pools',
  {
    poolAddress: varchar('pool_address', { length: 44 }).primaryKey(),
    dex: varchar('dex', { length: 16 }).notNull(),
    tokenMint: varchar('token_mint', { length: 44 }).notNull(),
    quoteMint: varchar('quote_mint', { length: 44 }).notNull(),

    // Reserves
    tokenReserve: bigint('token_reserve', { mode: 'bigint' }),
    quoteReserve: bigint('quote_reserve', { mode: 'bigint' }),
    liquidityUsd: real('liquidity_usd'),

    // Price
    priceUsd: real('price_usd'),
    priceNative: real('price_native'),

    // Activity
    createdAt: timestamp('created_at').notNull(),
    firstTradeAt: timestamp('first_trade_at'),
    lastTradeAt: timestamp('last_trade_at'),

    // Flags
    isActive: boolean('is_active').notNull().default(true),
    lpBurned: boolean('lp_burned').notNull().default(false),
    lpLockedUntil: timestamp('lp_locked_until'),

    // Timestamps
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  table => ({
    tokenMintIdx: index('pools_token_mint_idx').on(table.tokenMint),
    dexIdx: index('pools_dex_idx').on(table.dex),
    createdAtIdx: index('pools_created_at_idx').on(table.createdAt),
    isActiveIdx: index('pools_is_active_idx').on(table.isActive),
  })
);

// ============================================
// Trades Aggregate Table
// ============================================

export const tradesAggregate = pgTable(
  'trades_aggregate',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    tokenMint: varchar('token_mint', { length: 44 }).notNull(),
    poolAddress: varchar('pool_address', { length: 44 }),
    timeframe: varchar('timeframe', { length: 8 }).notNull(),
    periodStart: timestamp('period_start').notNull(),

    // Volume
    buyVolume: bigint('buy_volume', { mode: 'bigint' }).notNull().default(BigInt(0)),
    sellVolume: bigint('sell_volume', { mode: 'bigint' }).notNull().default(BigInt(0)),
    totalVolumeUsd: real('total_volume_usd'),

    // Counts
    buyCount: integer('buy_count').notNull().default(0),
    sellCount: integer('sell_count').notNull().default(0),
    uniqueTraders: integer('unique_traders').notNull().default(0),

    // Price
    openPrice: real('open_price'),
    closePrice: real('close_price'),
    highPrice: real('high_price'),
    lowPrice: real('low_price'),
  },
  table => ({
    tokenTimeframeIdx: index('trades_agg_token_timeframe_idx').on(
      table.tokenMint,
      table.timeframe,
      table.periodStart
    ),
    periodStartIdx: index('trades_agg_period_start_idx').on(table.periodStart),
    uniqueTokenPeriod: unique('trades_agg_unique').on(
      table.tokenMint,
      table.poolAddress,
      table.timeframe,
      table.periodStart
    ),
  })
);

// ============================================
// Holders Snapshots Table
// ============================================

export const holdersSnapshots = pgTable(
  'holders_snapshots',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    tokenMint: varchar('token_mint', { length: 44 }).notNull(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),

    totalHolders: integer('total_holders').notNull(),
    topHoldersPct: real('top_holders_pct').notNull(),

    // Top holders data (JSON array)
    holders: jsonb('holders').$type<HolderData[]>(),
  },
  table => ({
    tokenTimestampIdx: index('holders_token_timestamp_idx').on(table.tokenMint, table.timestamp),
  })
);

interface HolderData {
  wallet: string;
  balance: string; // bigint as string
  percentage: number;
  isLpAccount: boolean;
  isDexAccount: boolean;
}

// ============================================
// Social Snapshots Table
// ============================================

export const socialSnapshots = pgTable(
  'social_snapshots',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    tokenMint: varchar('token_mint', { length: 44 }).notNull(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),

    platform: varchar('platform', { length: 16 }).notNull(),

    mentions: integer('mentions').notNull().default(0),
    uniquePosters: integer('unique_posters').notNull().default(0),
    velocity: real('velocity'), // mentions per hour

    // Engagement
    likes: integer('likes').default(0),
    reposts: integer('reposts').default(0),
    replies: integer('replies').default(0),

    sentiment: real('sentiment'), // -1 to 1
    botLikelihood: real('bot_likelihood'),
  },
  table => ({
    tokenPlatformIdx: index('social_token_platform_idx').on(
      table.tokenMint,
      table.platform,
      table.timestamp
    ),
  })
);

// ============================================
// Scores Table
// ============================================

export const scores = pgTable(
  'scores',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    tokenMint: varchar('token_mint', { length: 44 }).notNull(),
    scoredAt: timestamp('scored_at').notNull().defaultNow(),
    mode: varchar('mode', { length: 16 }).notNull(),

    // Primary scores
    survivalScore: real('survival_score').notNull(),
    runnerScore: real('runner_score').notNull(),

    // Components
    safetyComponent: real('safety_component'),
    momentumComponent: real('momentum_component'),
    socialComponent: real('social_component'),
    verificationComponent: real('verification_component'),

    // Quality
    dataCompleteness: real('data_completeness').notNull(),
    confidenceBand: varchar('confidence_band', { length: 8 }).notNull(),

    // Flags
    isCandidate: boolean('is_candidate').notNull().default(false),
    hardRejected: boolean('hard_rejected').notNull().default(false),

    // Explanations
    explanation: jsonb('explanation').$type<string[]>(),
    redFlags: jsonb('red_flags').$type<string[]>(),
    greenFlags: jsonb('green_flags').$type<string[]>(),
  },
  table => ({
    tokenScoredIdx: index('scores_token_scored_idx').on(table.tokenMint, table.scoredAt),
    isCandidateIdx: index('scores_is_candidate_idx').on(table.isCandidate),
    survivalScoreIdx: index('scores_survival_score_idx').on(table.survivalScore),
    runnerScoreIdx: index('scores_runner_score_idx').on(table.runnerScore),
  })
);

// ============================================
// Alerts Table
// ============================================

export const alerts = pgTable(
  'alerts',
  {
    id: varchar('id', { length: 36 }).primaryKey(),
    type: varchar('type', { length: 32 }).notNull(),
    tokenMint: varchar('token_mint', { length: 44 }).notNull(),

    // Scores at time of alert
    survivalScore: real('survival_score').notNull(),
    runnerScore: real('runner_score').notNull(),
    confidenceBand: varchar('confidence_band', { length: 8 }).notNull(),

    // Content
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    details: jsonb('details').$type<AlertDetailsData>(),

    // Status
    createdAt: timestamp('created_at').notNull().defaultNow(),
    sentAt: timestamp('sent_at'),
    channels: jsonb('channels').$type<AlertChannelData[]>(),
  },
  table => ({
    typeIdx: index('alerts_type_idx').on(table.type),
    tokenMintIdx: index('alerts_token_mint_idx').on(table.tokenMint),
    createdAtIdx: index('alerts_created_at_idx').on(table.createdAt),
  })
);

interface AlertDetailsData {
  tokenName: string | null;
  tokenSymbol: string | null;
  priceUsd: number | null;
  liquidityUsd: number | null;
  marketCapUsd: number | null;
  keyMetrics: Record<string, string | number>;
  explanation: string[];
  redFlags: string[];
  greenFlags: string[];
  dexscreenerUrl: string | null;
  birdeyeUrl: string | null;
  solscanUrl: string;
}

interface AlertChannelData {
  type: string;
  sent: boolean;
  error: string | null;
}

// ============================================
// Safety Analysis Table
// ============================================

export const safetyAnalysis = pgTable(
  'safety_analysis',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    tokenMint: varchar('token_mint', { length: 44 }).notNull(),
    analyzedAt: timestamp('analyzed_at').notNull().defaultNow(),

    hardReject: boolean('hard_reject').notNull(),
    riskScore: real('risk_score').notNull(),

    checks: jsonb('checks').$type<SafetyCheckData[]>(),
    explanation: jsonb('explanation').$type<string[]>(),
  },
  table => ({
    tokenIdx: index('safety_token_idx').on(table.tokenMint),
    hardRejectIdx: index('safety_hard_reject_idx').on(table.hardReject),
  })
);

interface SafetyCheckData {
  name: string;
  passed: boolean;
  severity: string;
  details: string;
  weight: number;
}

// ============================================
// Blacklist Tables
// ============================================

export const blacklistWallets = pgTable('blacklist_wallets', {
  address: varchar('address', { length: 44 }).primaryKey(),
  reason: text('reason').notNull(),
  addedAt: timestamp('added_at').notNull().defaultNow(),
  source: varchar('source', { length: 16 }).notNull(),
});

export const blacklistMints = pgTable('blacklist_mints', {
  address: varchar('address', { length: 44 }).primaryKey(),
  reason: text('reason').notNull(),
  addedAt: timestamp('added_at').notNull().defaultNow(),
  source: varchar('source', { length: 16 }).notNull(),
});

// ============================================
// Cross Verification Table
// ============================================

export const crossVerification = pgTable(
  'cross_verification',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    tokenMint: varchar('token_mint', { length: 44 }).notNull(),
    verifiedAt: timestamp('verified_at').notNull().defaultNow(),

    sources: jsonb('sources').$type<DataSourceData[]>(),

    priceDiscrepancy: real('price_discrepancy'),
    volumeDiscrepancy: real('volume_discrepancy'),
    liquidityDiscrepancy: real('liquidity_discrepancy'),

    confidencePenalty: real('confidence_penalty'),
    explanation: jsonb('explanation').$type<string[]>(),
  },
  table => ({
    tokenIdx: index('cross_ver_token_idx').on(table.tokenMint),
  })
);

interface DataSourceData {
  name: string;
  enabled: boolean;
  available: boolean;
  lastFetch: string | null;
  price: number | null;
  volume24h: number | null;
  liquidity: number | null;
  marketCap: number | null;
}

// ============================================
// Relations
// ============================================

export const tokensRelations = relations(tokens, ({ many }) => ({
  pools: many(pools),
  scores: many(scores),
  alerts: many(alerts),
  safetyAnalysis: many(safetyAnalysis),
  holdersSnapshots: many(holdersSnapshots),
  socialSnapshots: many(socialSnapshots),
  tradesAggregate: many(tradesAggregate),
  crossVerification: many(crossVerification),
}));

export const poolsRelations = relations(pools, ({ one }) => ({
  token: one(tokens, {
    fields: [pools.tokenMint],
    references: [tokens.mintAddress],
  }),
}));

export const scoresRelations = relations(scores, ({ one }) => ({
  token: one(tokens, {
    fields: [scores.tokenMint],
    references: [tokens.mintAddress],
  }),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  token: one(tokens, {
    fields: [alerts.tokenMint],
    references: [tokens.mintAddress],
  }),
}));

// ============================================
// Type exports
// ============================================

export type Token = typeof tokens.$inferSelect;
export type NewToken = typeof tokens.$inferInsert;

export type Pool = typeof pools.$inferSelect;
export type NewPool = typeof pools.$inferInsert;

export type TradesAggregate = typeof tradesAggregate.$inferSelect;
export type NewTradesAggregate = typeof tradesAggregate.$inferInsert;

export type HoldersSnapshot = typeof holdersSnapshots.$inferSelect;
export type NewHoldersSnapshot = typeof holdersSnapshots.$inferInsert;

export type SocialSnapshot = typeof socialSnapshots.$inferSelect;
export type NewSocialSnapshot = typeof socialSnapshots.$inferInsert;

export type Score = typeof scores.$inferSelect;
export type NewScore = typeof scores.$inferInsert;

export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;

export type SafetyAnalysisRow = typeof safetyAnalysis.$inferSelect;
export type NewSafetyAnalysis = typeof safetyAnalysis.$inferInsert;

export type BlacklistWallet = typeof blacklistWallets.$inferSelect;
export type BlacklistMint = typeof blacklistMints.$inferSelect;

export type CrossVerificationRow = typeof crossVerification.$inferSelect;
export type NewCrossVerification = typeof crossVerification.$inferInsert;
