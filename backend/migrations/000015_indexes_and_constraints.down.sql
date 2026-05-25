BEGIN;

DROP TABLE IF EXISTS sensitive_audit_log;

ALTER TABLE users DROP COLUMN IF EXISTS deleted_at;

DROP INDEX IF EXISTS idx_frg_tx_ton_hash;
DROP INDEX IF EXISTS idx_frg_tx_charge_id;

ALTER TABLE clans DROP CONSTRAINT IF EXISTS chk_clans_members_nonneg;

DROP INDEX IF EXISTS idx_clans_username_lower;
DROP INDEX IF EXISTS idx_clan_members_clan_id;

COMMIT;
