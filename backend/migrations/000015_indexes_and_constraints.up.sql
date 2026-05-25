BEGIN;

-- 1. Performance: clan member lookups
CREATE INDEX IF NOT EXISTS idx_clan_members_clan_id ON clan_members(clan_id);

-- 2. Performance: case-insensitive clan search
CREATE INDEX IF NOT EXISTS idx_clans_username_lower ON clans(LOWER(channel_username));

-- 3. Data integrity: prevent zero/negative members
ALTER TABLE clans ADD CONSTRAINT chk_clans_members_nonneg
    CHECK (members_count >= 0);

-- 4. Idempotency for stars/toncoin charges
CREATE UNIQUE INDEX IF NOT EXISTS idx_frg_tx_charge_id
    ON frg_transactions ((metadata->>'telegram_charge_id'))
    WHERE metadata->>'telegram_charge_id' IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_frg_tx_ton_hash
    ON frg_transactions ((metadata->>'tx_hash'))
    WHERE metadata->>'tx_hash' IS NOT NULL;

-- 5. Soft delete column for GDPR compliance
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_users_active ON users(telegram_id) WHERE deleted_at IS NULL;

-- 6. Audit log for sensitive actions
CREATE TABLE IF NOT EXISTS sensitive_audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_user_action ON sensitive_audit_log(user_id, action, created_at DESC);

COMMIT;
