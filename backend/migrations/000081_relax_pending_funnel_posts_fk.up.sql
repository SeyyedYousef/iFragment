-- 000081_relax_pending_funnel_posts_fk.up.sql
BEGIN;

ALTER TABLE pending_funnel_posts DROP CONSTRAINT IF EXISTS pending_funnel_posts_funnel_id_fkey;

CREATE INDEX IF NOT EXISTS idx_pending_funnel_posts_funnel_id ON pending_funnel_posts (funnel_id);

COMMIT;

