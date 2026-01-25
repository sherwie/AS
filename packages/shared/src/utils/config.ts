/**
 * Configuration loader with validation
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { z } from 'zod';

// Load .env from project root (handles running from any package)
config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '..', '..', '.env') });
config({ path: resolve(process.cwd(), '..', '.env') });
import { ProviderConfig, ScoringConfig, SignalMode } from '../types/index.js';

// Environment schema
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/solana_signal'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Solana RPC
  SOLANA_RPC_HTTP: z.string().default('https://api.mainnet-beta.solana.com'),
  SOLANA_RPC_WS: z.string().default('wss://api.mainnet-beta.solana.com'),
  HELIUS_API_KEY: z.string().optional(),

  // Market data
  DEXSCREENER_ENABLED: z.string().transform(v => v === 'true').default('true'),
  GECKOTERMINAL_ENABLED: z.string().transform(v => v === 'true').default('true'),
  BIRDEYE_API_KEY: z.string().optional(),
  JUPITER_ENABLED: z.string().transform(v => v === 'true').default('true'),

  // Alerting
  DISCORD_WEBHOOK_URL: z.string().optional(),

  // Social
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_IDS: z.string().optional(),
  X_API_KEY: z.string().optional(),
  X_API_SECRET: z.string().optional(),
  X_ACCESS_TOKEN: z.string().optional(),
  X_ACCESS_SECRET: z.string().optional(),
  X_BEARER_TOKEN: z.string().optional(),
  DISCORD_BOT_TOKEN: z.string().optional(),
  DISCORD_CHANNEL_IDS: z.string().optional(),

  // Feature flags
  SIGNAL_MODE: z.enum(['GENESIS', 'IGNITION', 'BOTH']).default('BOTH'),
  ENABLE_RAYDIUM: z.string().transform(v => v === 'true').default('true'),
  ENABLE_ORCA: z.string().transform(v => v === 'true').default('true'),
  ENABLE_METEORA: z.string().transform(v => v === 'true').default('true'),
  ENABLE_PUMPFUN: z.string().transform(v => v === 'true').default('true'),
  ENABLE_TELEGRAM: z.string().transform(v => v === 'true').default('false'),
  ENABLE_TWITTER: z.string().transform(v => v === 'true').default('false'),
  ENABLE_DISCORD_MONITOR: z.string().transform(v => v === 'true').default('false'),

  // Thresholds
  GENESIS_SURVIVAL_MIN: z.string().transform(Number).default('60'),
  GENESIS_RUNNER_MIN: z.string().transform(Number).default('40'),
  IGNITION_SURVIVAL_MIN: z.string().transform(Number).default('50'),
  IGNITION_RUNNER_MIN: z.string().transform(Number).default('70'),
  HARD_REJECT_SURVIVAL: z.string().transform(Number).default('20'),

  // Safety
  MIN_LIQUIDITY_SOL: z.string().transform(Number).default('1'),
  MAX_TOP_HOLDER_PCT: z.string().transform(Number).default('50'),
  REJECT_FREEZE_AUTHORITY: z.string().transform(v => v === 'true').default('true'),
  REJECT_MINT_AUTHORITY: z.string().transform(v => v === 'true').default('true'),

  // Rate limits
  RPC_RATE_LIMIT: z.string().transform(Number).default('100'),
  DEXSCREENER_RATE_LIMIT: z.string().transform(Number).default('30'),
  GECKOTERMINAL_RATE_LIMIT: z.string().transform(Number).default('30'),
  JUPITER_RATE_LIMIT: z.string().transform(Number).default('60'),

  // System
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  PORT: z.string().transform(Number).default('3000'),
  METRICS_PORT: z.string().transform(Number).default('9090'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedEnv: EnvConfig | null = null;

export function loadEnv(): EnvConfig {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Environment validation failed:');
    console.error(result.error.format());
    throw new Error('Invalid environment configuration');
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function getProviderConfig(): ProviderConfig {
  const env = loadEnv();

  return {
    // RPC
    solanaRpcHttp: env.HELIUS_API_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`
      : env.SOLANA_RPC_HTTP,
    solanaRpcWs: env.HELIUS_API_KEY
      ? `wss://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`
      : env.SOLANA_RPC_WS,
    heliusApiKey: env.HELIUS_API_KEY || null,

    // Market data
    dexscreenerEnabled: env.DEXSCREENER_ENABLED,
    geckoterminalEnabled: env.GECKOTERMINAL_ENABLED,
    birdeyeApiKey: env.BIRDEYE_API_KEY || null,
    jupiterEnabled: env.JUPITER_ENABLED,

    // Social
    telegramBotToken: env.TELEGRAM_BOT_TOKEN || null,
    telegramChatIds: env.TELEGRAM_CHAT_IDS?.split(',').filter(Boolean) || [],
    twitterApiKey: env.X_BEARER_TOKEN || null,
    discordBotToken: env.DISCORD_BOT_TOKEN || null,
    discordChannelIds: env.DISCORD_CHANNEL_IDS?.split(',').filter(Boolean) || [],

    // Alerting
    discordWebhookUrl: env.DISCORD_WEBHOOK_URL || null,

    // DEX
    enableRaydium: env.ENABLE_RAYDIUM,
    enableOrca: env.ENABLE_ORCA,
    enableMeteora: env.ENABLE_METEORA,
    enablePumpfun: env.ENABLE_PUMPFUN,

    // Rate limits
    rpcRateLimit: env.RPC_RATE_LIMIT,
    dexscreenerRateLimit: env.DEXSCREENER_RATE_LIMIT,
    geckoterminalRateLimit: env.GECKOTERMINAL_RATE_LIMIT,
    jupiterRateLimit: env.JUPITER_RATE_LIMIT,
  };
}

export function getScoringConfig(): ScoringConfig {
  const env = loadEnv();

  return {
    mode: env.SIGNAL_MODE as SignalMode,
    genesisThresholds: {
      survivalMin: env.GENESIS_SURVIVAL_MIN,
      runnerMin: env.GENESIS_RUNNER_MIN,
    },
    ignitionThresholds: {
      survivalMin: env.IGNITION_SURVIVAL_MIN,
      runnerMin: env.IGNITION_RUNNER_MIN,
    },
    hardRejectSurvival: env.HARD_REJECT_SURVIVAL,
    weights: {
      safety: 0.35,
      momentum: 0.35,
      social: 0.15,
      verification: 0.15,
    },
    safety: {
      rejectFreezeAuthority: env.REJECT_FREEZE_AUTHORITY,
      rejectMintAuthority: env.REJECT_MINT_AUTHORITY,
      minLiquiditySol: env.MIN_LIQUIDITY_SOL,
      maxTopHolderPct: env.MAX_TOP_HOLDER_PCT,
    },
  };
}

// Check which features are available based on API keys
export function getFeatureAvailability() {
  const env = loadEnv();

  return {
    // RPC
    hasHelius: !!env.HELIUS_API_KEY,
    hasPublicRpc: true, // Always available

    // Market data (all have public tiers)
    hasDexScreener: env.DEXSCREENER_ENABLED,
    hasGeckoTerminal: env.GECKOTERMINAL_ENABLED,
    hasBirdeye: !!env.BIRDEYE_API_KEY,
    hasJupiter: env.JUPITER_ENABLED,

    // Social (require keys)
    hasTelegram: !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_IDS),
    hasTwitter: !!env.X_BEARER_TOKEN,
    hasDiscordMonitor: !!(env.DISCORD_BOT_TOKEN && env.DISCORD_CHANNEL_IDS),

    // Alerting
    hasDiscordWebhook: !!env.DISCORD_WEBHOOK_URL,

    // DEX
    hasRaydium: env.ENABLE_RAYDIUM,
    hasOrca: env.ENABLE_ORCA,
    hasMeteora: env.ENABLE_METEORA,
    hasPumpfun: env.ENABLE_PUMPFUN,
  };
}

export function printFeatureStatus() {
  const features = getFeatureAvailability();

  console.log('\n=== Feature Availability ===\n');

  console.log('RPC:');
  console.log(`  Public RPC: ${features.hasPublicRpc ? '✓' : '✗'}`);
  console.log(`  Helius (enhanced): ${features.hasHelius ? '✓' : '✗ (add HELIUS_API_KEY)'}`);

  console.log('\nMarket Data:');
  console.log(`  DexScreener: ${features.hasDexScreener ? '✓' : '✗'}`);
  console.log(`  GeckoTerminal: ${features.hasGeckoTerminal ? '✓' : '✗'}`);
  console.log(`  Birdeye: ${features.hasBirdeye ? '✓' : '✗ (add BIRDEYE_API_KEY)'}`);
  console.log(`  Jupiter: ${features.hasJupiter ? '✓' : '✗'}`);

  console.log('\nSocial Connectors:');
  console.log(`  Telegram: ${features.hasTelegram ? '✓' : '✗ (add TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_IDS)'}`);
  console.log(`  Twitter/X: ${features.hasTwitter ? '✓' : '✗ (add X_BEARER_TOKEN)'}`);
  console.log(`  Discord Monitor: ${features.hasDiscordMonitor ? '✓' : '✗ (add DISCORD_BOT_TOKEN + DISCORD_CHANNEL_IDS)'}`);

  console.log('\nAlerting:');
  console.log(`  Discord Webhook: ${features.hasDiscordWebhook ? '✓' : '✗ (add DISCORD_WEBHOOK_URL)'}`);

  console.log('\nDEX Support:');
  console.log(`  Raydium: ${features.hasRaydium ? '✓' : '✗'}`);
  console.log(`  Orca: ${features.hasOrca ? '✓' : '✗'}`);
  console.log(`  Meteora: ${features.hasMeteora ? '✓' : '✗'}`);
  console.log(`  Pump.fun: ${features.hasPumpfun ? '✓' : '✗'}`);

  console.log('\n');
}
