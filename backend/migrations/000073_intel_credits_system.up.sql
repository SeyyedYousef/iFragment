BEGIN;

-- 1. Intel Credit Batches: FIFO credit allocations from purchases, signups, tasks, promos
CREATE TABLE IF NOT EXISTS intel_credit_batches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    kind            VARCHAR(32) NOT NULL DEFAULT 'intel_report', -- 'username', 'number', 'gift', 'intel_report'
    amount          INT NOT NULL CHECK (amount > 0),
    remaining       INT NOT NULL CHECK (remaining >= 0),
    source          VARCHAR(32) NOT NULL, -- 'signup_bonus', 'purchase_stars', 'task_reward', 'promo'
    reference_id    TEXT, -- Task key, order payload, promo code
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_icb_user_active 
    ON intel_credit_batches(user_id, expires_at NULLS LAST, created_at) 
    WHERE remaining > 0;

-- 2. Intel Credit Ledger: Audit trail for every credit addition, deduction, or refund
CREATE TABLE IF NOT EXISTS intel_credit_ledger (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    delta           INT NOT NULL, -- -1 for consumption, +N for grant/refund
    reason          VARCHAR(64) NOT NULL, -- 'report:username', 'report:number', 'report:gift', 'reward:task', 'purchase:stars'
    entity          TEXT, -- e.g. '@durov', '+88888888888', 'plush_pepe-42'
    batch_id        UUID REFERENCES intel_credit_batches(id) ON DELETE SET NULL,
    idem_key        VARCHAR(128) UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_icl_user_created ON intel_credit_ledger(user_id, created_at DESC);

-- 3. Initial Signup Bonus: Grant 3 Intel Credits to all existing active users
INSERT INTO intel_credit_batches (user_id, kind, amount, remaining, source)
SELECT telegram_id, 'intel_report', 3, 3, 'signup_bonus'
FROM users
ON CONFLICT DO NOTHING;

-- 4. Additional indexes for Verticals performance
CREATE INDEX IF NOT EXISTS idx_venue_snapshots_model_venue_updated ON venue_snapshots(model_id, venue, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_number_sales_tail_date ON number_sales(number, sale_date DESC);

COMMIT;
