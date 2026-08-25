-- 000070_proliferation_fix_and_indexer_v2.down.sql

DROP TABLE IF EXISTS premium_gate_rules;
DROP TABLE IF EXISTS market_registry;
DROP TABLE IF EXISTS indexer_checkpoints;

ALTER TABLE broadcasts DROP COLUMN IF EXISTS updated_at;
ALTER TABLE broadcasts DROP COLUMN IF EXISTS failed_count;
ALTER TABLE broadcasts DROP COLUMN IF EXISTS total_count;
ALTER TABLE broadcasts DROP COLUMN IF EXISTS completed_at;
ALTER TABLE broadcasts DROP COLUMN IF EXISTS started_at;
ALTER TABLE broadcasts DROP COLUMN IF EXISTS scheduled_at;
