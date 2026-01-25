# Solana Meme Early Signal Bot

A production-grade, read-only signal detection system for Solana meme tokens. Designed to identify promising tokens early while filtering out rugs and scams.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        SOLANA MEME EARLY SIGNAL BOT                             │
│                         (Read-Only Architecture)                                │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────┐     ┌──────────────────────────────────┐
│           DATA SOURCES               │     │          STORAGE LAYER           │
├──────────────────────────────────────┤     ├──────────────────────────────────┤
│  ┌─────────────┐  ┌───────────────┐  │     │  ┌────────────┐ ┌─────────────┐  │
│  │ Solana RPC  │  │   Pump.fun    │  │     │  │ PostgreSQL │ │    Redis    │  │
│  │ (WebSocket) │  │  (On-Chain)   │  │     │  │  (Tokens,  │ │  (Cache,    │  │
│  └──────┬──────┘  └───────┬───────┘  │     │  │   Scores,  │ │   Queues)   │  │
│         │                 │          │     │  │   Alerts)  │ │             │  │
│  ┌──────┴──────┐  ┌───────┴───────┐  │     │  └────────────┘ └─────────────┘  │
│  │ DexScreener │  │ GeckoTerminal │  │     └──────────────────────────────────┘
│  │  (Public)   │  │   (Public)    │  │
│  └─────────────┘  └───────────────┘  │        ┌────────────────────────────┐
│  ┌─────────────┐                     │        │       JOB QUEUES           │
│  │   Jupiter   │                     │        │  ┌──────────────────────┐  │
│  │  (Quotes)   │                     │        │  │ token-discovery      │  │
│  └─────────────┘                     │        │  │ token-analysis       │  │
└──────────────────────────────────────┘        │  │ alert-dispatch       │  │
                                                │  └──────────────────────┘  │
┌──────────────────────────────────────┐        └────────────────────────────┘
│           SERVICES                   │
├──────────────────────────────────────┤
│                                      │        ┌────────────────────────────┐
│  ┌────────────────────────────────┐  │        │      ALERT CHANNELS        │
│  │         INGESTOR               │  │        │  ┌──────────────────────┐  │
│  │  - Token Discovery             │  │        │  │ Discord Webhooks     │  │
│  │  - Pool Detection              │  │───────▶│  │ (Embeds with scores) │  │
│  │  - Trade Aggregation           │  │        │  └──────────────────────┘  │
│  └────────────────────────────────┘  │        └────────────────────────────┘
│                                      │
│  ┌────────────────────────────────┐  │        ┌────────────────────────────┐
│  │         ANALYZER               │  │        │       DASHBOARD            │
│  │  - Risk Engine (9 checks)      │  │        │  ┌──────────────────────┐  │
│  │  - Momentum Engine             │  │───────▶│  │ Next.js 15           │  │
│  │  - Scoring Engine              │  │        │  │ - Token Explorer     │  │
│  │  - Cross-Verification          │  │        │  │ - Score Details      │  │
│  └────────────────────────────────┘  │        │  │ - Real-time Stats    │  │
│                                      │        │  └──────────────────────┘  │
│  ┌────────────────────────────────┐  │        └────────────────────────────┘
│  │         NOTIFIER               │  │
│  │  - Alert Formatting            │  │
│  │  - Channel Dispatch            │  │
│  │  - Rate Limiting               │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

## Features

- **Read-Only**: No trading, no private keys, no transactions - pure signal detection
- **No API Keys Required**: Works immediately with on-chain data and public APIs
- **Graceful Enhancement**: Automatically unlocks features when API keys are added
- **Two Detection Modes**:
  - **GENESIS**: First-minutes detection for microcaps
  - **IGNITION**: Post-launch momentum for breakout tokens
- **Two Scoring Dimensions**:
  - **Survival Score**: Safety and rug-resistance (0-100)
  - **Runner Score**: Momentum and potential (0-100)
- **9 Safety Checks**: Comprehensive rug filtering
- **Real-time Alerts**: Discord webhook notifications

## Quick Start

### 1. Clone and Install

```bash
git clone <repository>
cd AS
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

**Minimum Required**:
```env
# Solana RPC (get free from Helius, QuickNode, etc.)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_RPC_WS_URL=wss://api.mainnet-beta.solana.com

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/memebot

# Redis
REDIS_URL=redis://localhost:6379
```

### 3. Start Services

```bash
# Start infrastructure
docker-compose up -d postgres redis

# Run migrations
pnpm db:migrate

# Start all services
pnpm dev
```

Or run everything with Docker:

```bash
docker-compose up -d
```

### 4. Access Dashboard

Open http://localhost:3000 to view the dashboard.

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SOLANA_RPC_URL` | Yes | Solana RPC HTTP endpoint |
| `SOLANA_RPC_WS_URL` | Yes | Solana RPC WebSocket endpoint |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `DISCORD_WEBHOOK_URL` | No | Discord webhook for alerts |
| `PUMPFUN_API_KEY` | No | Pump.fun API key (optional) |
| `DEXSCREENER_API_KEY` | No | DexScreener API key (optional) |
| `GECKOTERMINAL_API_KEY` | No | GeckoTerminal API key (optional) |

### Mode Configuration

```env
# GENESIS: Focus on brand-new tokens (< 5 minutes old)
# IGNITION: Focus on momentum breakouts
BOT_MODE=GENESIS

# Score thresholds for alerts
SURVIVAL_THRESHOLD=60
RUNNER_THRESHOLD=70
```

## Safety Checks

The Risk Engine performs 9 safety checks:

| Check | Severity | Description |
|-------|----------|-------------|
| FREEZE_AUTHORITY | CRITICAL | Detects if token can be frozen |
| MINT_AUTHORITY | CRITICAL | Detects unlimited mint capability |
| SELLABILITY | CRITICAL | Verifies token can be sold |
| LIQUIDITY_MIN | HIGH | Checks minimum liquidity ($1000) |
| HOLDER_CONCENTRATION | HIGH | Top holder < 20% of supply |
| SNIPER_DETECTION | HIGH | Detects insider trading patterns |
| LP_STATUS | MEDIUM | Checks if LP is burned/locked |
| METADATA_VALID | LOW | Validates token metadata |
| BLACKLIST | CRITICAL | Known scammer addresses |

## Scoring System

### Survival Score (0-100)
Measures token safety and rug-resistance:
- Critical checks passed: +40 points base
- High severity checks: +15 points each
- Medium checks: +10 points each
- Deductions for failed checks based on severity

### Runner Score (0-100)
Measures momentum and breakout potential:
- Volume velocity: 30% weight
- Trade frequency: 20% weight
- Unique traders: 20% weight
- Holder growth: 15% weight
- Dip buying: 10% weight
- Liquidity stability: 5% weight

## Project Structure

```
packages/
├── shared/          # Shared types, utils, database
│   ├── src/
│   │   ├── types/       # TypeScript interfaces
│   │   ├── interfaces/  # Provider/engine contracts
│   │   ├── utils/       # Logger, config, rate-limiter
│   │   ├── db/          # Drizzle schema, client
│   │   └── queue/       # BullMQ setup
│   └── migrations/      # SQL migrations
│
├── ingestor/        # Data ingestion service
│   └── src/
│       ├── providers/   # Solana, Pump.fun, DEX APIs
│       └── index.ts     # Main worker
│
├── analyzer/        # Analysis service
│   └── src/
│       ├── engines/     # Risk, Momentum, Scoring
│       └── index.ts     # Main worker
│
├── notifier/        # Alert service
│   └── src/
│       ├── channels/    # Discord, Telegram
│       └── index.ts     # Main worker
│
└── dashboard/       # Next.js web UI
    └── src/
        └── app/         # App Router pages

tools/
└── key-wizard.js    # CLI configuration tool

tests/
├── unit/            # Unit tests
└── vitest.config.ts # Test configuration
```

## CLI Tools

### Key Wizard

Interactive configuration and testing tool:

```bash
# Check configuration status
node tools/key-wizard.js status

# Test all connections
node tools/key-wizard.js test

# Generate sample configuration
node tools/key-wizard.js generate
```

## API Endpoints

### Dashboard API

| Endpoint | Description |
|----------|-------------|
| `GET /api/stats` | Dashboard statistics |
| `GET /api/tokens/recent` | Recent token discoveries |
| `GET /api/tokens/[mint]` | Token details and scores |

## Alert Types

1. **GENESIS_SIGNAL**: New token detected with high potential
2. **IGNITION_SIGNAL**: Existing token showing breakout momentum
3. **RUG_WARNING**: Safety check failures detected

### Discord Alert Format

```
🚀 GENESIS SIGNAL
Token: EXAMPLE
━━━━━━━━━━━━━━━━━━
🛡️ Survival: 85/100
📈 Runner: 78/100
━━━━━━━━━━━━━━━━━━
💧 Liquidity: $15,000
📊 Volume (5m): $2,500
👥 Holders: 45
```

## Development

### Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

### Building

```bash
# Build all packages
pnpm build

# Build specific package
pnpm --filter @memebot/analyzer build
```

### Adding New Providers

1. Create provider in `packages/ingestor/src/providers/`
2. Implement the appropriate interface from `packages/shared/src/interfaces/`
3. Add configuration to `packages/shared/src/utils/config.ts`
4. Register in ingestor's `index.ts`

## Monitoring

### Prometheus Metrics

Available at `/metrics` endpoint:

- `memebot_tokens_discovered_total`
- `memebot_analysis_duration_seconds`
- `memebot_alerts_sent_total`
- `memebot_rpc_requests_total`
- `memebot_circuit_breaker_state`

### Health Checks

All services expose `/health` endpoint returning:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "checks": {
    "database": "ok",
    "redis": "ok",
    "rpc": "ok"
  }
}
```

## Roadmap

- [ ] Telegram bot integration
- [ ] Twitter/X social sentiment
- [ ] Historical backtesting
- [ ] ML-based pattern detection
- [ ] Multi-chain support (Base, BSC)

## License

MIT

## Disclaimer

This software is for educational and research purposes only. It does not constitute financial advice. Always do your own research before making any investment decisions. The authors are not responsible for any financial losses incurred from using this software.
