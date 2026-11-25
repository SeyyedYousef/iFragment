-- 000108_gram_broadcaster_dedup.up.sql
-- Durable PostgreSQL deduplication ledger for @TheGramPrice 10-minute posts and daily recaps.

BEGIN;

CREATE TABLE IF NOT EXISTS gram_broadcast_slots (
    channel_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    slot_key TEXT NOT NULL,
    price_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (channel_id, kind, slot_key)
);

CREATE INDEX IF NOT EXISTS idx_gram_broadcast_slots_channel_kind_sent
    ON gram_broadcast_slots (channel_id, kind, sent_at DESC);

COMMIT;
