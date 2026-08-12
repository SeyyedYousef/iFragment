BEGIN;

-- 1. Username Assets
CREATE TABLE IF NOT EXISTS username_assets (
    id                      BIGSERIAL PRIMARY KEY,
    username_normalized    TEXT NOT NULL UNIQUE,
    nft_address            TEXT,
    collection_address     TEXT,
    owner_address          TEXT,
    status                 TEXT NOT NULL DEFAULT 'unknown',
    is_collectible         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Verified Username Sales (Proof-of-Sale with transaction hash)
CREATE TABLE IF NOT EXISTS username_verified_sales (
    id                      BIGSERIAL PRIMARY KEY,
    username_normalized    TEXT NOT NULL,
    nft_address            TEXT,
    collection_address     TEXT,
    sale_contract          TEXT,
    transaction_hash       TEXT NOT NULL,
    event_index            INT NOT NULL DEFAULT 0,
    block_seqno            BIGINT,
    sale_type              TEXT NOT NULL DEFAULT 'auction',
    price_nano_ton         BIGINT NOT NULL,
    sold_at                TIMESTAMPTZ NOT NULL,
    buyer_address          TEXT,
    seller_address         TEXT,
    marketplace            TEXT NOT NULL DEFAULT 'fragment',
    source_url             TEXT,
    verification_status    TEXT NOT NULL DEFAULT 'verified',
    ingested_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_sale_tx_event UNIQUE (transaction_hash, event_index)
);

CREATE INDEX IF NOT EXISTS idx_verified_sales_username ON username_verified_sales(username_normalized, sold_at DESC);

-- 3. Market Snapshots (Listings & Active Bids)
CREATE TABLE IF NOT EXISTS username_market_snapshots (
    id                      BIGSERIAL PRIMARY KEY,
    username_normalized    TEXT NOT NULL,
    source                 TEXT NOT NULL DEFAULT 'fragment',
    external_id            TEXT,
    listing_price_nano_ton BIGINT,
    highest_bid_nano_ton   BIGINT,
    sale_type              TEXT,
    auction_ends_at        TIMESTAMPTZ,
    snapshot_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_market_snapshot_source_ext UNIQUE (source, external_id)
);

-- 4. Valuation Anchors (Model benchmarks kept separate from real sales)
CREATE TABLE IF NOT EXISTS valuation_anchors (
    id                      BIGSERIAL PRIMARY KEY,
    username_normalized    TEXT NOT NULL UNIQUE,
    anchor_type            TEXT NOT NULL DEFAULT 'model_estimate',
    estimated_price_nano_ton BIGINT NOT NULL,
    reason                 TEXT,
    model_version          TEXT NOT NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Username Transfers (NFT Transfer History)
CREATE TABLE IF NOT EXISTS username_transfers (
    id                      BIGSERIAL PRIMARY KEY,
    username_normalized    TEXT NOT NULL,
    nft_address            TEXT NOT NULL,
    transaction_hash       TEXT NOT NULL,
    from_address           TEXT,
    to_address             TEXT NOT NULL,
    transferred_at         TIMESTAMPTZ NOT NULL,

    CONSTRAINT unq_transfer_tx UNIQUE (transaction_hash)
);

-- 6. Purchased Analysis Reports
CREATE TABLE IF NOT EXISTS username_analysis_reports (
    report_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username_normalized    TEXT NOT NULL,
    user_id                BIGINT,
    fair_value_nano_ton    BIGINT NOT NULL,
    confidence_score       INT NOT NULL,
    report_snapshot        JSONB NOT NULL,
    purchased_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Report Data Sources & Provenance Logs
CREATE TABLE IF NOT EXISTS username_report_sources (
    id                      BIGSERIAL PRIMARY KEY,
    report_id              UUID NOT NULL REFERENCES username_analysis_reports(report_id) ON DELETE CASCADE,
    source_name            TEXT NOT NULL,
    status                 TEXT NOT NULL,
    latency_ms             INT,
    fetched_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Suggestions Engine Ledger
CREATE TABLE IF NOT EXISTS username_suggestions (
    id                      BIGSERIAL PRIMARY KEY,
    report_id              UUID NOT NULL REFERENCES username_analysis_reports(report_id) ON DELETE CASCADE,
    normalized_input       TEXT NOT NULL,
    normalized_suggestion  TEXT NOT NULL,
    suggestion_type        TEXT NOT NULL,
    relevance_score        NUMERIC(5,4) NOT NULL,
    availability           TEXT NOT NULL,
    reason                 TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_report_suggestion UNIQUE (report_id, normalized_suggestion),
    CONSTRAINT chk_diff_suggestion CHECK (normalized_suggestion <> normalized_input)
);

-- 9. Valuation Model Versions
CREATE TABLE IF NOT EXISTS valuation_model_versions (
    version_tag            TEXT PRIMARY KEY,
    description            TEXT,
    hyperparameters        JSONB NOT NULL,
    is_active              BOOLEAN NOT NULL DEFAULT FALSE,
    deployed_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Valuation Backtests & Holdout Calibration
CREATE TABLE IF NOT EXISTS valuation_backtests (
    id                      BIGSERIAL PRIMARY KEY,
    model_version          TEXT NOT NULL REFERENCES valuation_model_versions(version_tag),
    holdout_sample_size    INT NOT NULL,
    mean_absolute_error    NUMERIC(10,4) NOT NULL,
    median_absolute_error  NUMERIC(10,4) NOT NULL,
    evaluated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Source Fetch Logs
CREATE TABLE IF NOT EXISTS source_fetch_logs (
    id                      BIGSERIAL PRIMARY KEY,
    source                 TEXT NOT NULL,
    endpoint               TEXT NOT NULL,
    status_code            INT NOT NULL,
    error_message          TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
