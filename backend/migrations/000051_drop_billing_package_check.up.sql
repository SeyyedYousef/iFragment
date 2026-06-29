BEGIN;

ALTER TABLE billing_subscriptions DROP CONSTRAINT IF EXISTS billing_subscriptions_package_id_check;
ALTER TABLE channel_billing_subscriptions DROP CONSTRAINT IF EXISTS channel_billing_subscriptions_package_id_check;

COMMIT;
