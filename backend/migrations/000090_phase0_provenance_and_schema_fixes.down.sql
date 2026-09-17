BEGIN;

ALTER TABLE venue_snapshots ALTER COLUMN has_real_volume_badge SET DEFAULT TRUE;
DROP INDEX IF EXISTS idx_number_features_restricted;
DROP INDEX IF EXISTS idx_number_features_id;
ALTER TABLE number_features DROP COLUMN IF EXISTS is_restricted;
ALTER TABLE number_features DROP COLUMN IF EXISTS id;

COMMIT;
