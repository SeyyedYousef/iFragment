-- 000094_schema_p0_events_and_snapshots.up.sql
BEGIN;

-- 1. Check constraint on assets.vertical (SCHEMA-P0-001)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_assets_vertical'
    ) THEN 
        ALTER TABLE assets ADD CONSTRAINT chk_assets_vertical CHECK (vertical IN ('username', 'number', 'gift'));
    END IF;
END $$;

-- 2. Market Events Table (SCHEMA-P0-004)
CREATE TABLE IF NOT EXISTS market_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venue VARCHAR(64) NOT NULL,
    listing_id VARCHAR(128),
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    price_minor BIGINT NOT NULL,
    currency VARCHAR(16) NOT NULL DEFAULT 'TON',
    seller_address VARCHAR(128),
    buyer_address VARCHAR(128),
    settlement_tx_hash VARCHAR(128),
    event_index INTEGER,
    verification_status VARCHAR(32) NOT NULL DEFAULT 'unverified',
    price_confidence NUMERIC(5,4),
    observed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    source_observation_id UUID REFERENCES observations(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_market_events_price_positive CHECK (price_minor > 0),
    CONSTRAINT chk_market_events_sale_evidence CHECK (
        event_type != 'sale' OR (verification_status = 'verified' AND settlement_tx_hash IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_market_events_asset_time ON market_events(asset_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_events_venue_type ON market_events(venue, event_type);

-- 3. Rate Snapshots Table (SCHEMA-P0-005)
CREATE TABLE IF NOT EXISTS rate_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_currency VARCHAR(16) NOT NULL,
    quote_currency VARCHAR(16) NOT NULL DEFAULT 'USD',
    rate_decimal NUMERIC(18,8) NOT NULL,
    provider VARCHAR(64) NOT NULL,
    observed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(32) NOT NULL DEFAULT 'live',
    fallback_reason TEXT,
    CONSTRAINT chk_rate_snapshots_rate_positive CHECK (rate_decimal > 0)
);

CREATE INDEX IF NOT EXISTS idx_rate_snapshots_pair_time ON rate_snapshots(base_currency, quote_currency, observed_at DESC);

COMMIT;
