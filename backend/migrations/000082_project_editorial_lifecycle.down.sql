-- 000082_project_editorial_lifecycle.down.sql
BEGIN;

DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS deliveries CASCADE;
DROP TABLE IF EXISTS approval_decisions CASCADE;
DROP TABLE IF EXISTS approval_requests CASCADE;
DROP TABLE IF EXISTS content_revisions CASCADE;
DROP TABLE IF EXISTS content_items CASCADE;

COMMIT;
