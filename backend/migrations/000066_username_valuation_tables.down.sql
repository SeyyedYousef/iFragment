BEGIN;

DROP TABLE IF EXISTS source_fetch_logs CASCADE;
DROP TABLE IF EXISTS valuation_backtests CASCADE;
DROP TABLE IF EXISTS valuation_model_versions CASCADE;
DROP TABLE IF EXISTS username_suggestions CASCADE;
DROP TABLE IF EXISTS username_report_sources CASCADE;
DROP TABLE IF EXISTS username_analysis_reports CASCADE;
DROP TABLE IF EXISTS username_transfers CASCADE;
DROP TABLE IF EXISTS valuation_anchors CASCADE;
DROP TABLE IF EXISTS username_market_snapshots CASCADE;
DROP TABLE IF EXISTS username_verified_sales CASCADE;
DROP TABLE IF EXISTS username_assets CASCADE;

COMMIT;
