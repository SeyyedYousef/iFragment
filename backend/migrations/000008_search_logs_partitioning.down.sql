BEGIN;

-- 1. Rename partitioned table
ALTER TABLE search_logs RENAME TO search_logs_partitioned;

-- 2. Create the old non-partitioned table structure
CREATE TABLE search_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    user_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Copy all data back
INSERT INTO search_logs (id, username, user_id, created_at)
SELECT id, username, user_id, created_at FROM search_logs_partitioned;

-- 4. Drop the partitioned table
DROP TABLE search_logs_partitioned;

-- 5. Restore indexes
CREATE INDEX idx_search_logs_username ON search_logs(username);
CREATE INDEX idx_search_logs_created ON search_logs(created_at DESC);

COMMIT;
