BEGIN;
ALTER TABLE channel_funnels DROP COLUMN project_name;
COMMIT;
