BEGIN;

DROP INDEX IF EXISTS idx_users_username_trgm;
DROP INDEX IF EXISTS idx_clans_title_trgm;

ALTER TABLE user_stats RESET (fillfactor);
ALTER TABLE frg_balances RESET (fillfactor);
ALTER TABLE users RESET (fillfactor);
ALTER TABLE managed_groups RESET (fillfactor);
ALTER TABLE managed_channels RESET (fillfactor);

CREATE INDEX IF NOT EXISTS idx_user_stats_xp ON user_stats(xp DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payload_status ON orders(payload, status);

DROP INDEX IF EXISTS idx_username_reports_order_id;
DROP INDEX IF EXISTS idx_username_report_sources_report_id;
DROP INDEX IF EXISTS idx_valuation_backtests_model_version;

DROP INDEX IF EXISTS idx_search_logs_user_id;
DROP INDEX IF EXISTS idx_group_events_user_id;

COMMIT;
