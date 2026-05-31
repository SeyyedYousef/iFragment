BEGIN;

-- 1. Rename existing non-partitioned table
ALTER TABLE search_logs RENAME TO search_logs_old;
DROP INDEX IF EXISTS idx_search_logs_username;
DROP INDEX IF EXISTS idx_search_logs_created;

-- 2. Create partitioned parent table
CREATE TABLE search_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    user_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 3. Pre-create initial partitions for 2026
CREATE TABLE search_logs_y2026m05 PARTITION OF search_logs
    FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');

CREATE TABLE search_logs_y2026m06 PARTITION OF search_logs
    FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

CREATE TABLE search_logs_y2026m07 PARTITION OF search_logs
    FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');

-- No default partition to prevent locking partition worker creations.

-- 4. Copy existing data into the partitioned table
INSERT INTO search_logs (id, username, user_id, created_at)
SELECT id, username, user_id, created_at FROM search_logs_old;

-- 5. Drop old table
DROP TABLE search_logs_old;

-- 6. Create indexes on the new partitioned table
CREATE INDEX idx_search_logs_username ON search_logs(username);
CREATE INDEX idx_search_logs_created ON search_logs(created_at DESC);

COMMIT;
