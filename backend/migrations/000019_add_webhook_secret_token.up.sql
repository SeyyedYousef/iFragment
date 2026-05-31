BEGIN;

ALTER TABLE managed_bots ADD COLUMN webhook_secret_token TEXT;
UPDATE managed_bots SET webhook_secret_token = md5(random()::text) || md5(random()::text) WHERE webhook_secret_token IS NULL;
ALTER TABLE managed_bots ALTER COLUMN webhook_secret_token SET NOT NULL;

COMMIT;
