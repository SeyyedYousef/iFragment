BEGIN;

ALTER TABLE channel_forwarding_rules DROP COLUMN IF EXISTS source_channel;
ALTER TABLE channel_forwarding_rules DROP COLUMN IF EXISTS target_channel;

COMMIT;
