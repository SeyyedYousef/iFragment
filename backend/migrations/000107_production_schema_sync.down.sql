-- 000107_production_schema_sync.down.sql
BEGIN;

DROP INDEX IF EXISTS idx_report_entitlements_principal_product;
DROP INDEX IF EXISTS idx_orders_user_created_desc;
DROP INDEX IF EXISTS idx_gift_sales_model_date_desc;
DROP INDEX IF EXISTS idx_username_sales_lower_date;

DROP TABLE IF EXISTS number_alert_preferences;
DROP TABLE IF EXISTS managed_userbots;
DROP TABLE IF EXISTS active_bids;

COMMIT;
