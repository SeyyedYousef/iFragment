-- 000096_username_collection_institutional.down.sql
BEGIN;
DROP TABLE IF EXISTS username_segments_analytics CASCADE;
DROP TABLE IF EXISTS username_market_listings CASCADE;
DROP TABLE IF EXISTS username_collection_history CASCADE;
DROP TABLE IF EXISTS username_collection_metrics CASCADE;
COMMIT;
