BEGIN;

-- 1. Rename existing channel_posts table
ALTER TABLE channel_posts RENAME TO channel_posts_old;

-- 2. Create partitioned parent table
CREATE TABLE channel_posts (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES managed_channels(id) ON DELETE CASCADE,
    telegram_message_id BIGINT,
    author_user_id BIGINT,
    text TEXT,
    has_media BOOLEAN DEFAULT false,
    views_count INT DEFAULT 0,
    reactions_count INT DEFAULT 0,
    forwards_count INT DEFAULT 0,
    is_pinned BOOLEAN DEFAULT false,
    scheduled_at TIMESTAMPTZ,
    posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 3. Pre-create initial partitions for 2026
CREATE TABLE channel_posts_y2026m05 PARTITION OF channel_posts
    FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');

CREATE TABLE channel_posts_y2026m06 PARTITION OF channel_posts
    FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

CREATE TABLE channel_posts_y2026m07 PARTITION OF channel_posts
    FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');

CREATE TABLE channel_posts_default PARTITION OF channel_posts DEFAULT;

-- 4. Copy data from old table
INSERT INTO channel_posts (id, channel_id, telegram_message_id, author_user_id, text, has_media, views_count, reactions_count, forwards_count, is_pinned, scheduled_at, posted_at, created_at)
SELECT id, channel_id, telegram_message_id, author_user_id, text, has_media, views_count, reactions_count, forwards_count, is_pinned, scheduled_at, posted_at, created_at FROM channel_posts_old;

-- 5. Drop old table
DROP TABLE channel_posts_old;

-- 6. Create indexes on new partitioned table
CREATE INDEX idx_channel_posts_channel ON channel_posts(channel_id, created_at DESC);
CREATE INDEX idx_channel_posts_scheduled ON channel_posts(scheduled_at) WHERE scheduled_at IS NOT NULL AND posted_at IS NULL;

COMMIT;
