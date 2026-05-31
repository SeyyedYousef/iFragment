BEGIN;

ALTER TABLE managed_bots DROP COLUMN IF EXISTS webhook_secret_token;

COMMIT;
