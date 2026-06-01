BEGIN;

CREATE INDEX IF NOT EXISTS idx_frg_tx_user_type ON frg_transactions(user_id, type);

COMMIT;
