BEGIN;

DROP INDEX IF EXISTS idx_managed_groups_chat_id;

ALTER TABLE group_events RENAME TO group_events_partitioned;

CREATE TABLE group_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES managed_groups(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    user_id BIGINT,
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO group_events (id, group_id, event_type, user_id, payload, created_at)
SELECT id, group_id, event_type, user_id, payload, created_at FROM group_events_partitioned;

DROP TABLE group_events_partitioned;

CREATE INDEX idx_group_events_group_type ON group_events(group_id, event_type, created_at DESC);
CREATE INDEX idx_group_events_created ON group_events(created_at DESC);

COMMIT;
