BEGIN;

-- 1. Create index on managed_groups(chat_id)
CREATE INDEX IF NOT EXISTS idx_managed_groups_chat_id ON managed_groups(chat_id);

-- 2. Rename existing group_events table
ALTER TABLE group_events RENAME TO group_events_old;

-- 3. Create partitioned parent table
CREATE TABLE group_events (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES managed_groups(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    user_id BIGINT,
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 4. Pre-create initial partitions for 2026
CREATE TABLE group_events_y2026m05 PARTITION OF group_events
    FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');

CREATE TABLE group_events_y2026m06 PARTITION OF group_events
    FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

CREATE TABLE group_events_y2026m07 PARTITION OF group_events
    FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');
-- No default partition to prevent locking partition worker creations.

-- 5. Copy data
INSERT INTO group_events (id, group_id, event_type, user_id, payload, created_at)
SELECT id, group_id, event_type, user_id, payload, created_at FROM group_events_old;

-- 6. Drop old table
DROP TABLE group_events_old;

-- 7. Create indexes on new partitioned table
CREATE INDEX idx_group_events_group_type ON group_events(group_id, event_type, created_at DESC);
CREATE INDEX idx_group_events_created ON group_events(created_at DESC);

COMMIT;
