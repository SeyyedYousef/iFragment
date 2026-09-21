-- 000096_username_collection_institutional.up.sql
BEGIN;

-- 1. Daily & periodic collection metrics with exact numerical types (nanoTON & BIGINT)
CREATE TABLE IF NOT EXISTS username_collection_metrics (
    id SERIAL PRIMARY KEY,
    stat_date DATE NOT NULL UNIQUE,
    minted_supply BIGINT,
    circulating_supply BIGINT,
    unique_holders BIGINT,
    floor_ask_nano_ton BIGINT,
    floor_venue VARCHAR(64) DEFAULT 'fragment',
    median_sale_nano_ton BIGINT,
    volume_24h_nano_ton NUMERIC(28, 0) DEFAULT 0,
    sales_count_24h INT DEFAULT 0,
    unique_buyers_24h INT DEFAULT 0,
    unique_sellers_24h INT DEFAULT 0,
    active_listings_count INT DEFAULT 0,
    listed_share_pct NUMERIC(6, 4),
    top10_holder_share_pct NUMERIC(6, 4),
    market_pulse_demand VARCHAR(32) DEFAULT 'Steady',
    market_pulse_supply VARCHAR(32) DEFAULT 'Controlled',
    market_pulse_liquidity VARCHAR(32) DEFAULT 'High',
    market_pulse_momentum VARCHAR(32) DEFAULT 'Bullish',
    ton_usd_rate NUMERIC(12, 4),
    is_stale BOOLEAN NOT NULL DEFAULT FALSE,
    source_status VARCHAR(32) NOT NULL DEFAULT 'healthy',
    last_indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_username_coll_metrics_date ON username_collection_metrics(stat_date DESC);

-- 2. Time-series points for historical chart
CREATE TABLE IF NOT EXISTS username_collection_history (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    timeframe VARCHAR(16) NOT NULL, -- '24h', '7d', '30d', 'all'
    floor_nano_ton BIGINT NOT NULL,
    median_sale_nano_ton BIGINT,
    volume_nano_ton NUMERIC(28, 0) NOT NULL DEFAULT 0,
    sales_count INT NOT NULL DEFAULT 0,
    currency VARCHAR(16) NOT NULL DEFAULT 'TON',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_username_history_tf_time ON username_collection_history(timeframe, timestamp ASC);

-- 3. Live Verified Market Listings Feed
CREATE TABLE IF NOT EXISTS username_market_listings (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(128) NOT NULL,
    nft_item_address VARCHAR(128),
    venue VARCHAR(64) NOT NULL DEFAULT 'fragment', -- 'fragment', 'getgems', 'marketapp'
    listing_type VARCHAR(32) NOT NULL DEFAULT 'ask', -- 'ask', 'auction'
    ask_price_nano_ton BIGINT,
    current_bid_nano_ton BIGINT,
    next_min_bid_nano_ton BIGINT,
    bids_count INT DEFAULT 0,
    ends_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_url TEXT,
    CONSTRAINT chk_listing_positive_price CHECK (ask_price_nano_ton IS NULL OR ask_price_nano_ton > 0)
);

CREATE INDEX IF NOT EXISTS idx_username_listings_active_venue ON username_market_listings(is_active, venue, ask_price_nano_ton ASC);

-- 4. Segment Analytics (Character length, dictionary, crypto, numerical)
CREATE TABLE IF NOT EXISTS username_segments_analytics (
    id SERIAL PRIMARY KEY,
    segment_key VARCHAR(64) NOT NULL UNIQUE, -- 'short_4', 'len_5', 'len_6', 'len_7_plus', 'numeric', 'crypto', 'brands'
    segment_name VARCHAR(128) NOT NULL,
    supply_count INT NOT NULL DEFAULT 0,
    floor_nano_ton BIGINT,
    median_sale_nano_ton BIGINT,
    volume_nano_ton NUMERIC(28, 0) NOT NULL DEFAULT 0,
    sales_count_30d INT NOT NULL DEFAULT 0,
    liquidity_rating VARCHAR(32) DEFAULT 'Medium',
    confidence_score INT DEFAULT 95,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed baseline segment classifications
INSERT INTO username_segments_analytics (segment_key, segment_name, liquidity_rating, confidence_score)
VALUES
    ('short_4', '4 Letters', 'High', 99),
    ('len_5', '5 Letters', 'High', 95),
    ('len_6', '6 Letters', 'Medium', 90),
    ('len_7_plus', '7+ Letters', 'Medium', 85),
    ('numeric', 'Numeric Digits', 'High', 95),
    ('crypto', 'Crypto & Web3', 'High', 90),
    ('brands', 'Dictionary & Brand-like', 'Medium', 85)
ON CONFLICT (segment_key) DO NOTHING;

COMMIT;
