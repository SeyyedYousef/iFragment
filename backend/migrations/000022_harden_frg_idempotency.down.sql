BEGIN;

DROP INDEX IF EXISTS uq_frg_tx_charge_id;
DROP INDEX IF EXISTS uq_frg_tx_tx_hash;

ALTER TABLE frg_transactions DROP COLUMN IF EXISTS charge_id;
ALTER TABLE frg_transactions DROP COLUMN IF EXISTS tx_hash;

-- Recreate old expression-based indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_frg_tx_charge_id
    ON frg_transactions ((metadata->>'telegram_charge_id'))
    WHERE metadata->>'telegram_charge_id' IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_frg_tx_ton_hash
    ON frg_transactions ((metadata->>'tx_hash'))
    WHERE metadata->>'tx_hash' IS NOT NULL;

COMMIT;
