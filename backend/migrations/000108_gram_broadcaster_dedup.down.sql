-- 000108_gram_broadcaster_dedup.down.sql

BEGIN;

DROP INDEX IF EXISTS idx_gram_broadcast_slots_channel_kind_sent;
DROP TABLE IF EXISTS gram_broadcast_slots;

COMMIT;
