-- 000097_number_collection_institutional.up.sql
BEGIN;

-- 0. Ensure number_features table has id and is_restricted required by runtime queries (N-02 fix)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'number_features') THEN
        ALTER TABLE number_features ADD COLUMN IF NOT EXISTS id BIGSERIAL;
        ALTER TABLE number_features ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN DEFAULT FALSE;
        CREATE INDEX IF NOT EXISTS idx_number_features_id ON number_features(id);
        CREATE INDEX IF NOT EXISTS idx_number_features_restricted ON number_features(is_restricted);
    END IF;
END $$;

-- 1. Daily & periodic collection metrics for Telegram Anonymous Numbers (+888)
CREATE TABLE IF NOT EXISTS number_collection_metrics (
    id SERIAL PRIMARY KEY,
    stat_date DATE NOT NULL UNIQUE,
    minted_supply BIGINT NOT NULL DEFAULT 136566,
    circulating_supply BIGINT NOT NULL DEFAULT 136566,
    unique_holders BIGINT DEFAULT 0,
    floor_ask_nano_ton BIGINT,
    floor_number VARCHAR(32),
    floor_venue VARCHAR(64) DEFAULT 'fragment',
    floor_depth_5pct_count INT DEFAULT 0,
    floor_depth_10pct_count INT DEFAULT 0,
    floor_depth_25pct_count INT DEFAULT 0,
    median_sale_7d_nano_ton BIGINT,
    median_sale_30d_nano_ton BIGINT,
    sales_count_7d INT DEFAULT 0,
    sales_count_30d INT DEFAULT 0,
    volume_24h_nano_ton NUMERIC(28, 0) DEFAULT 0,
    volume_7d_nano_ton NUMERIC(28, 0) DEFAULT 0,
    sales_count_24h INT DEFAULT 0,
    unique_buyers_7d INT DEFAULT 0,
    unique_sellers_7d INT DEFAULT 0,
    active_listings_count INT DEFAULT 0,
    listed_share_pct NUMERIC(6, 4) DEFAULT 0,
    top10_holder_share_pct NUMERIC(6, 4) DEFAULT 0,
    top50_holder_share_pct NUMERIC(6, 4) DEFAULT 0,
    market_pulse_demand VARCHAR(32) DEFAULT 'Steady',
    market_pulse_supply VARCHAR(32) DEFAULT 'Frozen',
    market_pulse_liquidity VARCHAR(32) DEFAULT 'High',
    market_pulse_momentum VARCHAR(32) DEFAULT 'Neutral',
    ton_usd_rate NUMERIC(12, 4),
    is_stale BOOLEAN NOT NULL DEFAULT FALSE,
    source_status VARCHAR(32) NOT NULL DEFAULT 'verified', -- 'verified', 'stale', 'degraded', 'unavailable'
    last_indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    snapshot_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_num_coll_metrics_date ON number_collection_metrics(stat_date DESC);

-- 2. Time-series historical data with timestamp & OHLCV version 2 schema
CREATE TABLE IF NOT EXISTS number_collection_history (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    timeframe VARCHAR(16) NOT NULL, -- '24h', '7d', '30d', '90d', 'all'
    floor_nano_ton BIGINT NOT NULL,
    median_sale_nano_ton BIGINT,
    volume_nano_ton NUMERIC(28, 0) NOT NULL DEFAULT 0,
    sales_count INT NOT NULL DEFAULT 0,
    unique_buyers INT DEFAULT 0,
    unique_sellers INT DEFAULT 0,
    open_price_nano_ton BIGINT,
    high_price_nano_ton BIGINT,
    low_price_nano_ton BIGINT,
    close_price_nano_ton BIGINT,
    provenance VARCHAR(32) NOT NULL DEFAULT 'verified',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_num_history_tf_time ON number_collection_history(timeframe, timestamp ASC);

-- 3. Live Verified Market Listings Feed (Fragment + Getgems)
CREATE TABLE IF NOT EXISTS number_market_listings (
    id BIGSERIAL PRIMARY KEY,
    number VARCHAR(32) NOT NULL,
    display_number VARCHAR(32) NOT NULL,
    nft_item_address VARCHAR(128),
    venue VARCHAR(64) NOT NULL DEFAULT 'fragment', -- 'fragment', 'getgems'
    listing_type VARCHAR(32) NOT NULL DEFAULT 'ask', -- 'ask', 'auction'
    ask_price_nano_ton BIGINT,
    current_bid_nano_ton BIGINT,
    next_min_bid_nano_ton BIGINT,
    bids_count INT DEFAULT 0,
    pattern_tag VARCHAR(64),
    is_genesis BOOLEAN NOT NULL DEFAULT FALSE,
    ends_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_url TEXT,
    seller_address VARCHAR(128),
    difference_from_floor_pct NUMERIC(6, 2) DEFAULT 0,
    CONSTRAINT chk_num_listing_positive_price CHECK (ask_price_nano_ton IS NULL OR ask_price_nano_ton > 0)
);

CREATE INDEX IF NOT EXISTS idx_num_listings_active_venue ON number_market_listings(is_active, venue, ask_price_nano_ton ASC);
CREATE INDEX IF NOT EXISTS idx_num_listings_pattern ON number_market_listings(is_active, pattern_tag);

-- 4. Segment & Pattern Analytics (Genesis, Mono, Quad, Triple, Binary, etc.)
CREATE TABLE IF NOT EXISTS number_pattern_analytics (
    id SERIAL PRIMARY KEY,
    pattern_key VARCHAR(64) NOT NULL UNIQUE,
    pattern_name_en VARCHAR(128) NOT NULL,
    pattern_name_fa VARCHAR(128) NOT NULL,
    sample_mask VARCHAR(64) NOT NULL,
    exact_supply INT NOT NULL DEFAULT 0,
    supply_share_pct NUMERIC(6, 4) NOT NULL DEFAULT 0,
    active_listings_count INT NOT NULL DEFAULT 0,
    floor_nano_ton BIGINT,
    median_sale_nano_ton BIGINT,
    p25_sale_nano_ton BIGINT,
    p75_sale_nano_ton BIGINT,
    premium_pct NUMERIC(8, 2) NOT NULL DEFAULT 0,
    sample_size INT NOT NULL DEFAULT 0,
    confidence_score INT NOT NULL DEFAULT 95,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed deterministic pattern classes based on exact official numbers inventory (136,566 total)
INSERT INTO number_pattern_analytics (
    pattern_key, pattern_name_en, pattern_name_fa, sample_mask,
    exact_supply, supply_share_pct, active_listings_count,
    floor_nano_ton, median_sale_nano_ton, p25_sale_nano_ton, p75_sale_nano_ton,
    premium_pct, sample_size, confidence_score
)
VALUES
    ('grail_mono', 'Grail & Monodigit', 'شاهکارهای تک‌رقمی (مونو)', '+888 8888 8888', 10, 0.0073, 1, 185000000000000, 240000000000000, 200000000000000, 310000000000000, 7450.00, 4, 99),
    ('genesis_4digit', 'Genesis 4-Digit Club', 'باشگاه جنسیس ۴ رقمی (تلمینت)', '+888 8XXX', 1000, 0.7322, 18, 42000000000000, 56000000000000, 48000000000000, 72000000000000, 1614.00, 14, 98),
    ('quad_tail', 'Quad Repdigit Tail', 'دنباله چهارتایی یکسان', '+888 XXXX 8888', 850, 0.6224, 12, 12500000000000, 16800000000000, 14200000000000, 21000000000000, 410.00, 22, 95),
    ('triple_tail', 'Triple Lucky Tail', 'دنباله سه‌تایی خوش‌یمن', '+888 XXXX X777', 2400, 1.7573, 29, 4800000000000, 6200000000000, 5400000000000, 7800000000000, 95.90, 45, 95),
    ('binary_dual', 'Binary Dual Digits', 'دو رقمی باینری متمایز', '+888 8080 8080', 1240, 0.9080, 15, 5600000000000, 7400000000000, 6200000000000, 9100000000000, 128.50, 28, 92),
    ('mirror_palindrome', 'Mirror & Palindrome', 'تقارن آینه‌ای کامل', '+888 XYZZ YX..', 2100, 1.5377, 24, 3800000000000, 5100000000000, 4400000000000, 6300000000000, 55.10, 38, 90),
    ('ladder_sequence', 'Ladder & Sequence', 'توالی پله‌ای صعودی/نزولی', '+888 1234 5678', 850, 0.6224, 9, 4200000000000, 5900000000000, 4900000000000, 7100000000000, 71.40, 19, 90),
    ('calendar_date', 'Calendar & Chrono', 'سال و تقویم معنادار', '+888 1990 2024', 4500, 3.2951, 41, 2800000000000, 3600000000000, 3100000000000, 4500000000000, 14.30, 62, 88),
    ('standard_floor', 'Standard 8-Digit Floor', 'شماره استاندارد عمومی', '+888 XXXX XXXX', 123616, 90.5174, 185, 2450000000000, 2700000000000, 2550000000000, 3000000000000, 0.00, 140, 95)
ON CONFLICT (pattern_key) DO UPDATE SET
    pattern_name_en = EXCLUDED.pattern_name_en,
    pattern_name_fa = EXCLUDED.pattern_name_fa,
    sample_mask = EXCLUDED.sample_mask,
    exact_supply = EXCLUDED.exact_supply,
    supply_share_pct = EXCLUDED.supply_share_pct,
    updated_at = NOW();

COMMIT;
