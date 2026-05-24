BEGIN;

-- 1. Rename partitioned table
ALTER TABLE channel_posts RENAME TO channel_posts_partitioned;

-- 2. Create standard table again
CREATE TABLE channel_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Copy data from partitioned table
INSERT INTO channel_posts (id, channel_id, telegram_message_id, author_user_id, text, has_media, views_count, reactions_count, forwards_count, is_pinned, scheduled_at, posted_at, created_at)
SELECT id, channel_id, telegram_message_id, author_user_id, text, has_media, views_count, reactions_count, forwards_count, is_pinned, scheduled_at, posted_at, created_at FROM channel_posts_partitioned;

-- 4. Drop partitioned table (and all its partitions automatically)
DROP TABLE channel_posts_partitioned;

-- 5. Recreate indexes
CREATE INDEX idx_channel_posts_channel ON channel_posts(channel_id, created_at DESC);
CREATE INDEX idx_channel_posts_scheduled ON channel_posts(scheduled_at) WHERE scheduled_at IS NOT NULL AND posted_at IS NULL;

COMMIT;
