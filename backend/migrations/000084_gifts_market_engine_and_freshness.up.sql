-- 000084_gifts_market_engine_and_freshness.up.sql
BEGIN;

-- 1. Historical venue floor & volume time-series snapshots (replaces sin/cos synthetic history)
CREATE TABLE IF NOT EXISTS venue_snapshot_history (
    id                  BIGSERIAL PRIMARY KEY,
    model_id            VARCHAR(64) NOT NULL,
    venue               VARCHAR(32) NOT NULL,
    floor_price_raw     NUMERIC(18,4) NOT NULL,
    floor_price_gram    NUMERIC(18,4) NOT NULL,
    currency            VARCHAR(16) NOT NULL DEFAULT 'GRAM',
    volume_24h_gram     NUMERIC(18,4) NOT NULL DEFAULT 0,
    volume_7d_gram      NUMERIC(18,4) NOT NULL DEFAULT 0,
    active_listings     INT NOT NULL DEFAULT 0,
    captured_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venue_snap_hist_model_time 
ON venue_snapshot_history(model_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_venue_snap_hist_time 
ON venue_snapshot_history(captured_at DESC);

-- 2. Source health & circuit breaker registry
CREATE TABLE IF NOT EXISTS source_health (
    source_name         VARCHAR(64) PRIMARY KEY,
    status              VARCHAR(32) NOT NULL DEFAULT 'healthy', -- 'healthy', 'delayed', 'stale', 'degraded', 'offline'
    last_success_at     TIMESTAMPTZ,
    last_failure_at     TIMESTAMPTZ,
    consecutive_failures INT NOT NULL DEFAULT 0,
    response_time_ms    INT NOT NULL DEFAULT 0,
    error_message       TEXT,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Live marketplace listings cache
CREATE TABLE IF NOT EXISTS market_listings (
    id                  BIGSERIAL PRIMARY KEY,
    model_id            VARCHAR(64) NOT NULL,
    serial_number       INT NOT NULL,
    venue               VARCHAR(32) NOT NULL,
    listing_id          TEXT,
    price_gram          NUMERIC(18,4) NOT NULL,
    price_usd           NUMERIC(18,4),
    model_name          VARCHAR(128),
    backdrop_name       VARCHAR(128),
    symbol_name         VARCHAR(128),
    center_hex          VARCHAR(16),
    edge_hex            VARCHAR(16),
    buy_url             TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    observed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unq_market_listing UNIQUE (venue, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_market_listings_model_price 
ON market_listings(model_id, price_gram ASC) 
WHERE is_active = TRUE;

COMMIT;
