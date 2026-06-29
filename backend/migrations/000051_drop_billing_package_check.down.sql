BEGIN;

ALTER TABLE billing_subscriptions ADD CONSTRAINT billing_subscriptions_package_id_check CHECK (package_id IN ('starter', 'basic', 'pro', 'business'));
ALTER TABLE channel_billing_subscriptions ADD CONSTRAINT channel_billing_subscriptions_package_id_check CHECK (package_id IN ('starter', 'basic', 'pro', 'business'));

COMMIT;
