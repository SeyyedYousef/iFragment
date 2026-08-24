BEGIN;

-- 1. Number Features: Deterministic Rarity Profile and On-Chain Attributes
CREATE TABLE IF NOT EXISTS number_features (
    number              VARCHAR(16) PRIMARY KEY,
    color               VARCHAR(32) NOT NULL DEFAULT 'unknown',
    owner_address       TEXT,
    nft_address         TEXT,
    features            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_number_features_color ON number_features(color);
CREATE INDEX IF NOT EXISTS idx_number_features_gin ON number_features USING GIN (features);

-- 2. Feature Histograms: Global frequency distribution for exact percentiles
CREATE TABLE IF NOT EXISTS feature_histograms (
    feature_key         VARCHAR(64) NOT NULL,
    bucket              VARCHAR(64) NOT NULL,
    count               INT NOT NULL DEFAULT 0,
    PRIMARY KEY (feature_key, bucket)
);

-- 3. Number Sales: Verified on-chain trades for comps and price discovery
CREATE TABLE IF NOT EXISTS number_sales (
    id                  BIGSERIAL PRIMARY KEY,
    number              VARCHAR(16) NOT NULL,
    sale_price_ton      NUMERIC(18,4) NOT NULL,
    sale_type           TEXT NOT NULL DEFAULT 'auction',
    sale_date           TIMESTAMPTZ NOT NULL,
    buyer_address       TEXT,
    seller_address      TEXT,
    market_address      TEXT,
    price_confidence    TEXT NOT NULL DEFAULT 'exact',
    transaction_hash    TEXT,
    raw_data            JSONB,
    indexed_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_number_sales_num_date ON number_sales(number, sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_number_sales_date ON number_sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_number_sales_price ON number_sales(sale_price_ton DESC);

-- 4. Number Valuations: Audit trail for every NV Engine execution
CREATE TABLE IF NOT EXISTS number_valuations (
    id                  BIGSERIAL PRIMARY KEY,
    number              VARCHAR(16) NOT NULL,
    run_timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
    model_version       TEXT NOT NULL,
    config_snapshot     JSONB NOT NULL DEFAULT '{}',
    ton_usd_rate        NUMERIC(18,4) NOT NULL,
    base_price_ton      NUMERIC(18,4) NOT NULL,
    low_ton             NUMERIC(18,4) NOT NULL,
    expected_ton        NUMERIC(18,4) NOT NULL,
    high_ton            NUMERIC(18,4) NOT NULL,
    confidence_score    SMALLINT NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
    price_basis         TEXT NOT NULL DEFAULT 'pattern_comps_shrunk_to_class',
    comparable_sale_ids BIGINT[] NOT NULL DEFAULT '{}',
    reasoning_log       JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_number_valuations_num_ts ON number_valuations(number, run_timestamp DESC);

-- 5. Purchased Premium Number Reports
CREATE TABLE IF NOT EXISTS number_reports (
    report_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    number              VARCHAR(16) NOT NULL,
    fair_value_nano_ton BIGINT NOT NULL DEFAULT 0,
    confidence_score    INT NOT NULL DEFAULT 0,
    report_snapshot     JSONB NOT NULL,
    purchased_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_number_reports_user ON number_reports(user_id, purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_number_reports_num ON number_reports(number);

-- 6. Number Watchlist: Strictly enabled only after report purchase
CREATE TABLE IF NOT EXISTS number_watchlist (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    number              VARCHAR(16) NOT NULL,
    alert_on_sale       BOOLEAN NOT NULL DEFAULT TRUE,
    alert_on_bid        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unq_user_number_watchlist UNIQUE (user_id, number)
);

CREATE INDEX IF NOT EXISTS idx_number_watchlist_user ON number_watchlist(user_id);

-- 7. Bootstrap Checkpoints: Resilient sync mechanism
CREATE TABLE IF NOT EXISTS number_bootstrap_checkpoints (
    id                  SERIAL PRIMARY KEY,
    last_offset         INT NOT NULL DEFAULT 0,
    total_scanned       INT NOT NULL DEFAULT 0,
    is_completed        BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Model Calibration: Nightly accuracy tracking
CREATE TABLE IF NOT EXISTS number_model_calibrations (
    id                  BIGSERIAL PRIMARY KEY,
    scope               VARCHAR(32) NOT NULL DEFAULT 'numbers',
    evaluated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    sample_size         INT NOT NULL DEFAULT 0,
    median_error_pct    NUMERIC(8,4) NOT NULL DEFAULT 0,
    within_band_pct     NUMERIC(8,4) NOT NULL DEFAULT 0
);

COMMIT;
