BEGIN;

ALTER TABLE group_settings ADD COLUMN dynamic_bio JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMIT;
