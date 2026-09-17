-- 000094_schema_p0_events_and_snapshots.down.sql
BEGIN;

DROP TABLE IF EXISTS rate_snapshots CASCADE;
DROP TABLE IF EXISTS market_events CASCADE;

DO $$ 
BEGIN 
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_assets_vertical'
    ) THEN 
        ALTER TABLE assets DROP CONSTRAINT chk_assets_vertical;
    END IF;
END $$;

COMMIT;
