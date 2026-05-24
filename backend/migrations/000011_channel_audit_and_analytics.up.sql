BEGIN;

-- =============================================
-- Channel Audit Logs
-- =============================================
CREATE TABLE channel_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES managed_channels(id) ON DELETE CASCADE,
    actor_id BIGINT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    old_value JSONB,
    new_value JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_channel_audit_logs_channel ON channel_audit_logs(channel_id, created_at DESC);

-- =============================================
-- Channel Analytics Snapshots
-- =============================================
CREATE TABLE channel_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES managed_channels(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    subscribers_count INT NOT NULL DEFAULT 0,
    new_subscribers INT NOT NULL DEFAULT 0,
    views_count INT NOT NULL DEFAULT 0,
    reactions_count INT NOT NULL DEFAULT 0,
    posts_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(channel_id, snapshot_date)
);

CREATE INDEX idx_channel_analytics_date ON channel_analytics(channel_id, snapshot_date DESC);

COMMIT;
