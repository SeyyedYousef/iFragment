BEGIN;

ALTER TABLE channel_inline_buttons DROP COLUMN IF EXISTS is_active;

COMMIT;
