#!/usr/bin/env node

/**
 * Key Wizard CLI
 * Interactive tool for configuring API keys and testing connectivity
 */

import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// ============================================
// Configuration Items
// ============================================

const CONFIG_ITEMS = {
  // Required
  DATABASE_URL: {
    required: true,
    description: 'PostgreSQL connection string',
    default: 'postgresql://postgres:postgres@localhost:5432/solana_signal',
    instructions: `
Setup PostgreSQL:
1. Install PostgreSQL locally or use Docker
2. Create database: CREATE DATABASE solana_signal;
3. Use connection string format: postgresql://user:password@host:port/database
    `,
  },
  REDIS_URL: {
    required: true,
    description: 'Redis connection string',
    default: 'redis://localhost:6379',
    instructions: `
Setup Redis:
1. Install Redis locally or use Docker
2. Default URL works for local setup: redis://localhost:6379
    `,
  },

  // Solana RPC
  SOLANA_RPC_HTTP: {
    required: false,
    description: 'Solana RPC HTTP endpoint',
    default: 'https://api.mainnet-beta.solana.com',
    instructions: `
Public RPC (default, rate-limited):
  https://api.mainnet-beta.solana.com

For better performance, get a free RPC from:
  - Helius: https://www.helius.dev/ (recommended)
  - QuickNode: https://www.quicknode.com/
  - Alchemy: https://www.alchemy.com/
    `,
  },
  HELIUS_API_KEY: {
    required: false,
    description: 'Helius API key for enhanced RPC',
    instructions: `
Get a free Helius API key:
1. Go to https://www.helius.dev/
2. Sign up for a free account
3. Create a new API key
4. Copy the key here

Benefits:
- Higher rate limits
- Transaction history APIs
- DAS API for NFT/Token metadata
    `,
  },

  // Discord
  DISCORD_WEBHOOK_URL: {
    required: false,
    description: 'Discord webhook URL for alerts',
    instructions: `
Create a Discord webhook:
1. Open Discord server settings
2. Go to Integrations > Webhooks
3. Click "New Webhook"
4. Choose channel for alerts
5. Copy webhook URL

Format: https://discord.com/api/webhooks/XXXXX/YYYYYY
    `,
  },

  // Telegram
  TELEGRAM_BOT_TOKEN: {
    required: false,
    description: 'Telegram bot token',
    instructions: `
Create a Telegram bot:
1. Message @BotFather on Telegram
2. Send /newbot
3. Follow prompts to create bot
4. Copy the token (format: 123456789:AAABBB...)

Note: Your bot must be added to the groups you want to monitor.
    `,
  },
  TELEGRAM_CHAT_IDS: {
    required: false,
    description: 'Telegram chat IDs to monitor (comma-separated)',
    instructions: `
Get chat IDs:
1. Add bot to target group
2. Send a message in the group
3. Visit: https://api.telegram.org/bot<TOKEN>/getUpdates
4. Find "chat":{"id":-1001234567890} in response
5. Use the negative number as chat ID

Multiple IDs: -1001234567890,-1009876543210
    `,
  },

  // Twitter/X
  X_BEARER_TOKEN: {
    required: false,
    description: 'Twitter/X API Bearer Token',
    instructions: `
Get X API access:
1. Apply at https://developer.twitter.com/
2. Create a project and app
3. Generate Bearer Token
4. Copy the token

Note: X API requires approval and may have usage fees.
    `,
  },

  // Market Data
  BIRDEYE_API_KEY: {
    required: false,
    description: 'Birdeye API key',
    instructions: `
Get Birdeye API key:
1. Go to https://birdeye.so/
2. Sign up and verify account
3. Navigate to API section
4. Generate API key

Note: Free tier has limited requests.
    `,
  },
};

// ============================================
// Helper Functions
// ============================================

function printHeader() {
  console.log(chalk.cyan(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║       ${chalk.bold('SOLANA MEME SIGNAL BOT - KEY WIZARD')}                   ║
║                                                               ║
║   Configure your API keys and test connectivity               ║
║   The system works WITHOUT keys in "no-keys" mode            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`));
}

function readEnvFile() {
  const envPath = path.join(rootDir, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    const env = {};
    for (const line of content.split('\n')) {
      if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
    return env;
  }
  return {};
}

function getEnvValue(key) {
  return process.env[key] || readEnvFile()[key] || '';
}

async function testConnection(type, url, options = {}) {
  try {
    switch (type) {
      case 'postgres':
        // Simplified test - just check URL format
        return url.startsWith('postgresql://');

      case 'redis':
        return url.startsWith('redis://');

      case 'rpc':
        const rpcResponse = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getHealth',
          }),
        });
        return rpcResponse.ok;

      case 'discord_webhook':
        // Test by getting webhook info
        const discordResponse = await fetch(url);
        return discordResponse.ok;

      case 'telegram':
        const telegramResponse = await fetch(
          `https://api.telegram.org/bot${options.token}/getMe`
        );
        return telegramResponse.ok;

      case 'birdeye':
        const birdeyeResponse = await fetch(
          'https://public-api.birdeye.so/public/tokenlist?sort_by=v24hUSD&sort_type=desc&limit=1',
          {
            headers: { 'X-API-KEY': options.apiKey },
          }
        );
        return birdeyeResponse.ok;

      default:
        return false;
    }
  } catch (error) {
    return false;
  }
}

// ============================================
// Main Functions
// ============================================

async function checkCurrentConfig() {
  console.log(chalk.yellow('\n📋 Current Configuration Status:\n'));

  const env = readEnvFile();
  const categories = {
    'Required': ['DATABASE_URL', 'REDIS_URL'],
    'Solana RPC': ['SOLANA_RPC_HTTP', 'HELIUS_API_KEY'],
    'Alerting': ['DISCORD_WEBHOOK_URL'],
    'Social': ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_IDS', 'X_BEARER_TOKEN'],
    'Market Data': ['BIRDEYE_API_KEY'],
  };

  for (const [category, keys] of Object.entries(categories)) {
    console.log(chalk.cyan(`\n${category}:`));
    for (const key of keys) {
      const value = env[key] || process.env[key];
      const config = CONFIG_ITEMS[key];
      const status = value
        ? chalk.green('✓ Configured')
        : config?.required
        ? chalk.red('✗ Missing (required)')
        : chalk.gray('○ Not set (optional)');

      console.log(`  ${key}: ${status}`);
    }
  }
}

async function runConnectivityTests() {
  console.log(chalk.yellow('\n🔌 Running Connectivity Tests:\n'));

  const tests = [
    {
      name: 'Solana RPC',
      test: async () => {
        const url = getEnvValue('HELIUS_API_KEY')
          ? `https://mainnet.helius-rpc.com/?api-key=${getEnvValue('HELIUS_API_KEY')}`
          : getEnvValue('SOLANA_RPC_HTTP') || 'https://api.mainnet-beta.solana.com';
        return testConnection('rpc', url);
      },
    },
    {
      name: 'Discord Webhook',
      skip: () => !getEnvValue('DISCORD_WEBHOOK_URL'),
      test: async () => testConnection('discord_webhook', getEnvValue('DISCORD_WEBHOOK_URL')),
    },
    {
      name: 'Telegram Bot',
      skip: () => !getEnvValue('TELEGRAM_BOT_TOKEN'),
      test: async () => testConnection('telegram', '', { token: getEnvValue('TELEGRAM_BOT_TOKEN') }),
    },
    {
      name: 'Birdeye API',
      skip: () => !getEnvValue('BIRDEYE_API_KEY'),
      test: async () => testConnection('birdeye', '', { apiKey: getEnvValue('BIRDEYE_API_KEY') }),
    },
  ];

  for (const { name, test, skip } of tests) {
    if (skip?.()) {
      console.log(`  ${name}: ${chalk.gray('○ Skipped (not configured)')}`);
      continue;
    }

    process.stdout.write(`  ${name}: `);
    const result = await test();
    console.log(result ? chalk.green('✓ Connected') : chalk.red('✗ Failed'));
  }
}

function generateEnvFile() {
  console.log(chalk.yellow('\n📝 Generating .env file...\n'));

  const env = readEnvFile();
  const lines = [
    '# ============================================',
    '# SOLANA MEME SIGNAL BOT - CONFIGURATION',
    '# Generated by key-wizard',
    '# ============================================',
    '',
    '# Required',
    `DATABASE_URL=${env.DATABASE_URL || CONFIG_ITEMS.DATABASE_URL.default}`,
    `REDIS_URL=${env.REDIS_URL || CONFIG_ITEMS.REDIS_URL.default}`,
    '',
    '# Solana RPC',
    `SOLANA_RPC_HTTP=${env.SOLANA_RPC_HTTP || CONFIG_ITEMS.SOLANA_RPC_HTTP.default}`,
    `SOLANA_RPC_WS=wss://api.mainnet-beta.solana.com`,
    `# HELIUS_API_KEY=${env.HELIUS_API_KEY || ''}`,
    '',
    '# Alerting',
    `# DISCORD_WEBHOOK_URL=${env.DISCORD_WEBHOOK_URL || ''}`,
    '',
    '# Social Connectors (optional)',
    `# TELEGRAM_BOT_TOKEN=${env.TELEGRAM_BOT_TOKEN || ''}`,
    `# TELEGRAM_CHAT_IDS=${env.TELEGRAM_CHAT_IDS || ''}`,
    `# X_BEARER_TOKEN=${env.X_BEARER_TOKEN || ''}`,
    '',
    '# Market Data',
    'DEXSCREENER_ENABLED=true',
    'GECKOTERMINAL_ENABLED=true',
    'JUPITER_ENABLED=true',
    `# BIRDEYE_API_KEY=${env.BIRDEYE_API_KEY || ''}`,
    '',
    '# Feature Flags',
    'SIGNAL_MODE=BOTH',
    'ENABLE_RAYDIUM=true',
    'ENABLE_ORCA=true',
    'ENABLE_METEORA=true',
    'ENABLE_PUMPFUN=true',
    '',
    '# Scoring Thresholds',
    'GENESIS_SURVIVAL_MIN=60',
    'GENESIS_RUNNER_MIN=40',
    'IGNITION_SURVIVAL_MIN=50',
    'IGNITION_RUNNER_MIN=70',
    '',
    '# Safety Filters',
    'MIN_LIQUIDITY_SOL=1',
    'MAX_TOP_HOLDER_PCT=50',
    'REJECT_FREEZE_AUTHORITY=true',
    'REJECT_MINT_AUTHORITY=true',
    '',
    '# System',
    'NODE_ENV=production',
    'LOG_LEVEL=info',
    'PORT=3000',
  ];

  const envPath = path.join(rootDir, '.env');
  fs.writeFileSync(envPath, lines.join('\n'));
  console.log(chalk.green(`✓ Generated ${envPath}`));
  console.log(chalk.gray('  Edit this file to add your API keys'));
}

function showInstructions(key) {
  const config = CONFIG_ITEMS[key];
  if (!config) {
    console.log(chalk.red(`Unknown configuration key: ${key}`));
    return;
  }

  console.log(chalk.cyan(`\n📖 Instructions for ${key}:\n`));
  console.log(chalk.white(config.description));
  console.log(chalk.gray(config.instructions));
}

function printUsage() {
  console.log(`
${chalk.bold('Usage:')} node tools/key-wizard.js [command]

${chalk.bold('Commands:')}
  status      Show current configuration status
  test        Test connectivity to configured services
  generate    Generate/update .env file
  help <key>  Show setup instructions for a specific key

${chalk.bold('Examples:')}
  node tools/key-wizard.js status
  node tools/key-wizard.js test
  node tools/key-wizard.js generate
  node tools/key-wizard.js help DISCORD_WEBHOOK_URL
  node tools/key-wizard.js help TELEGRAM_BOT_TOKEN

${chalk.bold('Available Keys:')}
  ${Object.keys(CONFIG_ITEMS).join('\n  ')}
`);
}

// ============================================
// Main
// ============================================

async function main() {
  printHeader();

  const command = process.argv[2] || 'status';
  const arg = process.argv[3];

  switch (command) {
    case 'status':
      await checkCurrentConfig();
      break;

    case 'test':
      await runConnectivityTests();
      break;

    case 'generate':
      generateEnvFile();
      break;

    case 'help':
      if (arg) {
        showInstructions(arg);
      } else {
        printUsage();
      }
      break;

    default:
      printUsage();
  }

  console.log(chalk.gray('\n---'));
  console.log(chalk.gray('Run with --help for more options'));
}

main().catch(console.error);
