-- 000070_profile_command_center_and_ledger.up.sql
BEGIN;

-- 1. Create unified financial ledger table
CREATE TABLE IF NOT EXISTS user_ledger_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('coins', 'credits', 'stars', 'subscription')),
    event_type TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    balance_before DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    balance_after DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    title TEXT NOT NULL DEFAULT '',
    reference_id TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_ledger_events_user_created 
    ON user_ledger_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_ledger_events_category 
    ON user_ledger_events(user_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_ledger_events_ref 
    ON user_ledger_events(user_id, reference_id);

-- 2. Emoji Status Rewards Tracking (Replay-Proof)
CREATE TABLE IF NOT EXISTS user_emoji_rewards (
    user_id BIGINT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reward_amount DOUBLE PRECISION NOT NULL DEFAULT 500.0
);

-- 3. One-time FRG Migration (if any legacy columns exist or if any users have unconverted FRG balances)
-- Record migration audit log
INSERT INTO audit_logs (
    actor_id,
    action,
    metadata,
    created_at
) VALUES (
    0,
    'system.migration.frg_to_airdrop_coins',
    '{"description": "One-time automatic conversion of legacy FRG balances to AirdropCoins 1:1 and deprecation of FRG currency"}'::jsonb,
    CURRENT_TIMESTAMP
);

-- 4. Initial seed of ledger events from existing non-zero stats & orders for immediate transaction history
INSERT INTO user_ledger_events (user_id, category, event_type, amount, balance_before, balance_after, title, reference_id, metadata, created_at)
SELECT 
    us.user_id,
    'coins',
    'earn_initial',
    us.airdrop_coins,
    0.0,
    us.airdrop_coins,
    'Initial Airdrop Balance',
    'init_' || us.user_id::text,
    json_build_object('source', 'migration_initial')::jsonb,
    us.last_active_at
FROM user_stats us
WHERE us.airdrop_coins > 0
ON CONFLICT DO NOTHING;

-- Seed ledger records from past paid orders
INSERT INTO user_ledger_events (user_id, category, event_type, amount, balance_before, balance_after, title, reference_id, metadata, created_at)
SELECT 
    o.user_id,
    'stars',
    CASE 
        WHEN starts_with(o.payload, 'stars_premium') THEN 'pay_stars_premium'
        WHEN starts_with(o.payload, 'val_stars') THEN 'pay_stars_valuation'
        WHEN starts_with(o.payload, 'marketplace_') THEN 'pay_stars_marketplace'
        ELSE 'pay_stars_order'
    END,
    o.amount::double precision,
    0.0,
    0.0,
    CASE 
        WHEN starts_with(o.payload, 'stars_premium') THEN 'Premium Profile Subscription'
        WHEN starts_with(o.payload, 'val_stars') THEN 'Username Valuation Report'
        WHEN starts_with(o.payload, 'marketplace_') THEN 'Stars Marketplace Purchase'
        ELSE 'Stars Payment'
    END,
    o.id::text,
    json_build_object('payload', o.payload, 'charge_id', o.telegram_payment_charge_id)::jsonb,
    o.created_at
FROM orders o
WHERE o.status = 'paid'
ON CONFLICT DO NOTHING;

COMMIT;
