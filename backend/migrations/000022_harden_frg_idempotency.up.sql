BEGIN;

-- Drop redundant expression-based unique indexes
DROP INDEX IF EXISTS idx_frg_tx_charge_id;
DROP INDEX IF EXISTS idx_frg_tx_ton_hash;

-- Add dedicated columns
ALTER TABLE frg_transactions ADD COLUMN IF NOT EXISTS charge_id TEXT;
ALTER TABLE frg_transactions ADD COLUMN IF NOT EXISTS tx_hash TEXT;

-- Backfill from existing JSONB metadata
UPDATE frg_transactions SET charge_id = metadata->>'telegram_charge_id'
  WHERE charge_id IS NULL AND metadata ? 'telegram_charge_id';
UPDATE frg_transactions SET tx_hash = metadata->>'tx_hash'
  WHERE tx_hash IS NULL AND metadata ? 'tx_hash';

-- Create high-performance Unique expression/partial indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_frg_tx_charge_id ON frg_transactions (charge_id) WHERE charge_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_frg_tx_tx_hash ON frg_transactions (tx_hash) WHERE tx_hash IS NOT NULL;

COMMIT;
