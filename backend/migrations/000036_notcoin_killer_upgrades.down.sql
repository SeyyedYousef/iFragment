BEGIN;

ALTER TABLE quests DROP COLUMN IF EXISTS expires_at;
ALTER TABLE quests DROP COLUMN IF EXISTS a_b_test_group;

DROP INDEX IF EXISTS idx_clans_total_score;
ALTER TABLE clans DROP COLUMN IF EXISTS total_score;

DROP TABLE IF EXISTS user_cipher_claims CASCADE;
DROP TABLE IF EXISTS daily_ciphers CASCADE;

-- Recreate FRG tables (bare minimum for rollback)
CREATE TABLE IF NOT EXISTS frg_balances (
    user_id BIGINT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
    balance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS frg_transactions (
    id SERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(telegram_id) ON DELETE CASCADE,
    amount DECIMAL(18,2) NOT NULL,
    type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
