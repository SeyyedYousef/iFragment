BEGIN;

ALTER TABLE channel_forwarding_rules ADD COLUMN IF NOT EXISTS source_channel TEXT NOT NULL DEFAULT '';
ALTER TABLE channel_forwarding_rules ADD COLUMN IF NOT EXISTS target_channel TEXT NOT NULL DEFAULT '';

COMMIT;
