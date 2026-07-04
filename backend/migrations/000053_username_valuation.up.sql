BEGIN;

-- ============================================================
-- Username Sales: Historical sale data for AVM comparables
-- ============================================================
CREATE TABLE IF NOT EXISTS username_sales (
    id              BIGSERIAL PRIMARY KEY,
    username        TEXT NOT NULL,
    sale_price_ton  NUMERIC(18,4) NOT NULL,
    sale_type       TEXT NOT NULL,
    sale_date       TIMESTAMPTZ NOT NULL,
    buyer_address   TEXT,
    seller_address  TEXT,
    is_wash         BOOLEAN NOT NULL DEFAULT FALSE,
    char_length     SMALLINT NOT NULL,
    segment         TEXT NOT NULL DEFAULT 'other',
    has_numbers     BOOLEAN NOT NULL DEFAULT FALSE,
    has_underscore  BOOLEAN NOT NULL DEFAULT FALSE,
    is_dictionary   BOOLEAN NOT NULL DEFAULT FALSE,
    source          TEXT NOT NULL DEFAULT 'marketapp',
    raw_data        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_sale_type CHECK (sale_type IN ('auction', 'buy_now', 'offer')),
    CONSTRAINT chk_segment   CHECK (segment IN ('alpha', 'numeric', 'mixed', 'underscore', 'other'))
);

-- Composite index for exact-match comparables (segment + length, non-wash)
CREATE INDEX idx_sales_segment_length
    ON username_sales(segment, char_length, sale_date DESC)
    WHERE is_wash = FALSE;

-- Broad segment lookup (segment-only, non-wash)
CREATE INDEX idx_sales_segment_broad
    ON username_sales(segment, sale_date DESC)
    WHERE is_wash = FALSE;

-- Momentum window counts
CREATE INDEX idx_sales_momentum
    ON username_sales(segment, char_length, sale_date DESC)
    WHERE is_wash = FALSE;

-- Username lookup
CREATE INDEX idx_sales_username ON username_sales(username);

-- ============================================================
-- Valuation Runs: Audit trail for every valuation
-- ============================================================
CREATE TABLE IF NOT EXISTS valuation_runs (
    id                  BIGSERIAL PRIMARY KEY,
    username            TEXT NOT NULL,
    run_timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
    model_version       TEXT NOT NULL,
    config_snapshot     JSONB NOT NULL,
    ton_usd_rate        NUMERIC(18,4) NOT NULL,
    base_price_ton      NUMERIC(18,4) NOT NULL,
    low_ton             NUMERIC(18,4) NOT NULL,
    expected_ton        NUMERIC(18,4) NOT NULL,
    high_ton            NUMERIC(18,4) NOT NULL,
    confidence_score    SMALLINT NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
    comparable_sale_ids BIGINT[] NOT NULL DEFAULT '{}',
    reasoning_log       JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_valuation_username_ts
    ON valuation_runs(username, run_timestamp DESC);

COMMIT;
