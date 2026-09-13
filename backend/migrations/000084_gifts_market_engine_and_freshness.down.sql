-- 000084_gifts_market_engine_and_freshness.down.sql
BEGIN;

DROP TABLE IF EXISTS market_listings;
DROP TABLE IF EXISTS source_health;
DROP TABLE IF EXISTS venue_snapshot_history;

COMMIT;
