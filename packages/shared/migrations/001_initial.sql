-- ============================================
-- Solana Meme Signal Bot - Initial Migration
-- ============================================

-- Tokens table
CREATE TABLE IF NOT EXISTS tokens (
    mint_address VARCHAR(44) PRIMARY KEY,
    name VARCHAR(255),
    symbol VARCHAR(32),
    decimals INTEGER NOT NULL DEFAULT 9,
    supply BIGINT,

    -- Authorities
    mint_authority VARCHAR(44),
    freeze_authority VARCHAR(44),

    -- Metadata
    metadata_uri TEXT,
    image TEXT,
    description TEXT,

    -- Discovery
    discovered_at TIMESTAMP NOT NULL DEFAULT NOW(),
    discovery_source VARCHAR(32) NOT NULL,
    creator_wallet VARCHAR(44),

    -- Status
    status VARCHAR(16) NOT NULL DEFAULT 'TRACKING',

    -- Pump.fun specific
    is_pumpfun BOOLEAN NOT NULL DEFAULT FALSE,
    bonding_curve_address VARCHAR(44),
    bonding_curve_progress REAL,
    graduated_at TIMESTAMP,
    graduated_pool_address VARCHAR(44),

    -- Timestamps
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tokens_status_idx ON tokens(status);
CREATE INDEX IF NOT EXISTS tokens_discovered_at_idx ON tokens(discovered_at);
CREATE INDEX IF NOT EXISTS tokens_creator_wallet_idx ON tokens(creator_wallet);
CREATE INDEX IF NOT EXISTS tokens_is_pumpfun_idx ON tokens(is_pumpfun);

-- Pools table
CREATE TABLE IF NOT EXISTS pools (
    pool_address VARCHAR(44) PRIMARY KEY,
    dex VARCHAR(16) NOT NULL,
    token_mint VARCHAR(44) NOT NULL,
    quote_mint VARCHAR(44) NOT NULL,

    -- Reserves
    token_reserve BIGINT,
    quote_reserve BIGINT,
    liquidity_usd REAL,

    -- Price
    price_usd REAL,
    price_native REAL,

    -- Activity
    created_at TIMESTAMP NOT NULL,
    first_trade_at TIMESTAMP,
    last_trade_at TIMESTAMP,

    -- Flags
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    lp_burned BOOLEAN NOT NULL DEFAULT FALSE,
    lp_locked_until TIMESTAMP,

    -- Timestamps
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pools_token_mint_idx ON pools(token_mint);
CREATE INDEX IF NOT EXISTS pools_dex_idx ON pools(dex);
CREATE INDEX IF NOT EXISTS pools_created_at_idx ON pools(created_at);
CREATE INDEX IF NOT EXISTS pools_is_active_idx ON pools(is_active);

-- Trades aggregate table
CREATE TABLE IF NOT EXISTS trades_aggregate (
    id SERIAL PRIMARY KEY,
    token_mint VARCHAR(44) NOT NULL,
    pool_address VARCHAR(44),
    timeframe VARCHAR(8) NOT NULL,
    period_start TIMESTAMP NOT NULL,

    -- Volume
    buy_volume BIGINT NOT NULL DEFAULT 0,
    sell_volume BIGINT NOT NULL DEFAULT 0,
    total_volume_usd REAL,

    -- Counts
    buy_count INTEGER NOT NULL DEFAULT 0,
    sell_count INTEGER NOT NULL DEFAULT 0,
    unique_traders INTEGER NOT NULL DEFAULT 0,

    -- Price
    open_price REAL,
    close_price REAL,
    high_price REAL,
    low_price REAL,

    UNIQUE(token_mint, pool_address, timeframe, period_start)
);

CREATE INDEX IF NOT EXISTS trades_agg_token_timeframe_idx ON trades_aggregate(token_mint, timeframe, period_start);
CREATE INDEX IF NOT EXISTS trades_agg_period_start_idx ON trades_aggregate(period_start);

-- Holders snapshots table
CREATE TABLE IF NOT EXISTS holders_snapshots (
    id SERIAL PRIMARY KEY,
    token_mint VARCHAR(44) NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),

    total_holders INTEGER NOT NULL,
    top_holders_pct REAL NOT NULL,

    -- Top holders data (JSON array)
    holders JSONB
);

CREATE INDEX IF NOT EXISTS holders_token_timestamp_idx ON holders_snapshots(token_mint, timestamp);

-- Social snapshots table
CREATE TABLE IF NOT EXISTS social_snapshots (
    id SERIAL PRIMARY KEY,
    token_mint VARCHAR(44) NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),

    platform VARCHAR(16) NOT NULL,

    mentions INTEGER NOT NULL DEFAULT 0,
    unique_posters INTEGER NOT NULL DEFAULT 0,
    velocity REAL,

    -- Engagement
    likes INTEGER DEFAULT 0,
    reposts INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,

    sentiment REAL,
    bot_likelihood REAL
);

CREATE INDEX IF NOT EXISTS social_token_platform_idx ON social_snapshots(token_mint, platform, timestamp);

-- Scores table
CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    token_mint VARCHAR(44) NOT NULL,
    scored_at TIMESTAMP NOT NULL DEFAULT NOW(),
    mode VARCHAR(16) NOT NULL,

    -- Primary scores
    survival_score REAL NOT NULL,
    runner_score REAL NOT NULL,

    -- Components
    safety_component REAL,
    momentum_component REAL,
    social_component REAL,
    verification_component REAL,

    -- Quality
    data_completeness REAL NOT NULL,
    confidence_band VARCHAR(8) NOT NULL,

    -- Flags
    is_candidate BOOLEAN NOT NULL DEFAULT FALSE,
    hard_rejected BOOLEAN NOT NULL DEFAULT FALSE,

    -- Explanations
    explanation JSONB,
    red_flags JSONB,
    green_flags JSONB
);

CREATE INDEX IF NOT EXISTS scores_token_scored_idx ON scores(token_mint, scored_at);
CREATE INDEX IF NOT EXISTS scores_is_candidate_idx ON scores(is_candidate);
CREATE INDEX IF NOT EXISTS scores_survival_score_idx ON scores(survival_score);
CREATE INDEX IF NOT EXISTS scores_runner_score_idx ON scores(runner_score);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id VARCHAR(36) PRIMARY KEY,
    type VARCHAR(32) NOT NULL,
    token_mint VARCHAR(44) NOT NULL,

    -- Scores at time of alert
    survival_score REAL NOT NULL,
    runner_score REAL NOT NULL,
    confidence_band VARCHAR(8) NOT NULL,

    -- Content
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    details JSONB,

    -- Status
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMP,
    channels JSONB
);

CREATE INDEX IF NOT EXISTS alerts_type_idx ON alerts(type);
CREATE INDEX IF NOT EXISTS alerts_token_mint_idx ON alerts(token_mint);
CREATE INDEX IF NOT EXISTS alerts_created_at_idx ON alerts(created_at);

-- Safety analysis table
CREATE TABLE IF NOT EXISTS safety_analysis (
    id SERIAL PRIMARY KEY,
    token_mint VARCHAR(44) NOT NULL,
    analyzed_at TIMESTAMP NOT NULL DEFAULT NOW(),

    hard_reject BOOLEAN NOT NULL,
    risk_score REAL NOT NULL,

    checks JSONB,
    explanation JSONB
);

CREATE INDEX IF NOT EXISTS safety_token_idx ON safety_analysis(token_mint);
CREATE INDEX IF NOT EXISTS safety_hard_reject_idx ON safety_analysis(hard_reject);

-- Blacklist tables
CREATE TABLE IF NOT EXISTS blacklist_wallets (
    address VARCHAR(44) PRIMARY KEY,
    reason TEXT NOT NULL,
    added_at TIMESTAMP NOT NULL DEFAULT NOW(),
    source VARCHAR(16) NOT NULL
);

CREATE TABLE IF NOT EXISTS blacklist_mints (
    address VARCHAR(44) PRIMARY KEY,
    reason TEXT NOT NULL,
    added_at TIMESTAMP NOT NULL DEFAULT NOW(),
    source VARCHAR(16) NOT NULL
);

-- Cross verification table
CREATE TABLE IF NOT EXISTS cross_verification (
    id SERIAL PRIMARY KEY,
    token_mint VARCHAR(44) NOT NULL,
    verified_at TIMESTAMP NOT NULL DEFAULT NOW(),

    sources JSONB,

    price_discrepancy REAL,
    volume_discrepancy REAL,
    liquidity_discrepancy REAL,

    confidence_penalty REAL,
    explanation JSONB
);

CREATE INDEX IF NOT EXISTS cross_ver_token_idx ON cross_verification(token_mint);

-- ============================================
-- Functions and triggers
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tokens
DROP TRIGGER IF EXISTS tokens_updated_at ON tokens;
CREATE TRIGGER tokens_updated_at
    BEFORE UPDATE ON tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Apply trigger to pools
DROP TRIGGER IF EXISTS pools_updated_at ON pools;
CREATE TRIGGER pools_updated_at
    BEFORE UPDATE ON pools
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
