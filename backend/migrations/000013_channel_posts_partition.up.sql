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


CREATE TABLE channel_posts_y2026m08 PARTITION OF channel_posts
    FOR VALUES FROM ('2026-08-01 00:00:00+00') TO ('2026-09-01 00:00:00+00');

CREATE TABLE channel_posts_y2026m09 PARTITION OF channel_posts
    FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');

CREATE TABLE channel_posts_y2026m10 PARTITION OF channel_posts
    FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2026-11-01 00:00:00+00');

CREATE TABLE channel_posts_y2026m11 PARTITION OF channel_posts
    FOR VALUES FROM ('2026-11-01 00:00:00+00') TO ('2026-12-01 00:00:00+00');

CREATE TABLE channel_posts_y2026m12 PARTITION OF channel_posts
    FOR VALUES FROM ('2026-12-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

CREATE TABLE channel_posts_y2027m01 PARTITION OF channel_posts
    FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2027-02-01 00:00:00+00');

CREATE TABLE channel_posts_y2027m02 PARTITION OF channel_posts
    FOR VALUES FROM ('2027-02-01 00:00:00+00') TO ('2027-03-01 00:00:00+00');

CREATE TABLE channel_posts_y2027m03 PARTITION OF channel_posts
    FOR VALUES FROM ('2027-03-01 00:00:00+00') TO ('2027-04-01 00:00:00+00');

CREATE TABLE channel_posts_y2027m04 PARTITION OF channel_posts
    FOR VALUES FROM ('2027-04-01 00:00:00+00') TO ('2027-05-01 00:00:00+00');

CREATE TABLE channel_posts_y2027m05 PARTITION OF channel_posts
    FOR VALUES FROM ('2027-05-01 00:00:00+00') TO ('2027-06-01 00:00:00+00');

CREATE TABLE channel_posts_y2027m06 PARTITION OF channel_posts
    FOR VALUES FROM ('2027-06-01 00:00:00+00') TO ('2027-07-01 00:00:00+00');

CREATE TABLE channel_posts_y2027m07 PARTITION OF channel_posts
    FOR VALUES FROM ('2027-07-01 00:00:00+00') TO ('2027-08-01 00:00:00+00');

CREATE TABLE channel_posts_y2027m08 PARTITION OF channel_posts
    FOR VALUES FROM ('2027-08-01 00:00:00+00') TO ('2027-09-01 00:00:00+00');

CREATE TABLE channel_posts_y2027m09 PARTITION OF channel_posts
    FOR VALUES FROM ('2027-09-01 00:00:00+00') TO ('2027-10-01 00:00:00+00');

CREATE TABLE channel_posts_y2027m10 PARTITION OF channel_posts
    FOR VALUES FROM ('2027-10-01 00:00:00+00') TO ('2027-11-01 00:00:00+00');

CREATE TABLE channel_posts_y2027m11 PARTITION OF channel_posts
    FOR VALUES FROM ('2027-11-01 00:00:00+00') TO ('2027-12-01 00:00:00+00');

CREATE TABLE channel_posts_y2027m12 PARTITION OF channel_posts
    FOR VALUES FROM ('2027-12-01 00:00:00+00') TO ('2028-01-01 00:00:00+00');

CREATE TABLE channel_posts_y2028m01 PARTITION OF channel_posts
    FOR VALUES FROM ('2028-01-01 00:00:00+00') TO ('2028-02-01 00:00:00+00');

CREATE TABLE channel_posts_y2028m02 PARTITION OF channel_posts
    FOR VALUES FROM ('2028-02-01 00:00:00+00') TO ('2028-03-01 00:00:00+00');

CREATE TABLE channel_posts_y2028m03 PARTITION OF channel_posts
    FOR VALUES FROM ('2028-03-01 00:00:00+00') TO ('2028-04-01 00:00:00+00');

CREATE TABLE channel_posts_y2028m04 PARTITION OF channel_posts
    FOR VALUES FROM ('2028-04-01 00:00:00+00') TO ('2028-05-01 00:00:00+00');

CREATE TABLE channel_posts_y2028m05 PARTITION OF channel_posts
    FOR VALUES FROM ('2028-05-01 00:00:00+00') TO ('2028-06-01 00:00:00+00');

CREATE TABLE channel_posts_y2028m06 PARTITION OF channel_posts
    FOR VALUES FROM ('2028-06-01 00:00:00+00') TO ('2028-07-01 00:00:00+00');

CREATE TABLE channel_posts_y2028m07 PARTITION OF channel_posts
    FOR VALUES FROM ('2028-07-01 00:00:00+00') TO ('2028-08-01 00:00:00+00');

CREATE TABLE channel_posts_y2028m08 PARTITION OF channel_posts
    FOR VALUES FROM ('2028-08-01 00:00:00+00') TO ('2028-09-01 00:00:00+00');

CREATE TABLE channel_posts_y2028m09 PARTITION OF channel_posts
    FOR VALUES FROM ('2028-09-01 00:00:00+00') TO ('2028-10-01 00:00:00+00');

CREATE TABLE channel_posts_y2028m10 PARTITION OF channel_posts
    FOR VALUES FROM ('2028-10-01 00:00:00+00') TO ('2028-11-01 00:00:00+00');

CREATE TABLE channel_posts_y2028m11 PARTITION OF channel_posts
    FOR VALUES FROM ('2028-11-01 00:00:00+00') TO ('2028-12-01 00:00:00+00');

CREATE TABLE channel_posts_y2028m12 PARTITION OF channel_posts
    FOR VALUES FROM ('2028-12-01 00:00:00+00') TO ('2029-01-01 00:00:00+00');

CREATE TABLE channel_posts_y2029m01 PARTITION OF channel_posts
    FOR VALUES FROM ('2029-01-01 00:00:00+00') TO ('2029-02-01 00:00:00+00');

CREATE TABLE channel_posts_y2029m02 PARTITION OF channel_posts
    FOR VALUES FROM ('2029-02-01 00:00:00+00') TO ('2029-03-01 00:00:00+00');

CREATE TABLE channel_posts_y2029m03 PARTITION OF channel_posts
    FOR VALUES FROM ('2029-03-01 00:00:00+00') TO ('2029-04-01 00:00:00+00');

CREATE TABLE channel_posts_y2029m04 PARTITION OF channel_posts
    FOR VALUES FROM ('2029-04-01 00:00:00+00') TO ('2029-05-01 00:00:00+00');

CREATE TABLE channel_posts_y2029m05 PARTITION OF channel_posts
    FOR VALUES FROM ('2029-05-01 00:00:00+00') TO ('2029-06-01 00:00:00+00');

CREATE TABLE channel_posts_y2029m06 PARTITION OF channel_posts
    FOR VALUES FROM ('2029-06-01 00:00:00+00') TO ('2029-07-01 00:00:00+00');

CREATE TABLE channel_posts_y2029m07 PARTITION OF channel_posts
    FOR VALUES FROM ('2029-07-01 00:00:00+00') TO ('2029-08-01 00:00:00+00');

CREATE TABLE channel_posts_y2029m08 PARTITION OF channel_posts
    FOR VALUES FROM ('2029-08-01 00:00:00+00') TO ('2029-09-01 00:00:00+00');

CREATE TABLE channel_posts_y2029m09 PARTITION OF channel_posts
    FOR VALUES FROM ('2029-09-01 00:00:00+00') TO ('2029-10-01 00:00:00+00');

CREATE TABLE channel_posts_y2029m10 PARTITION OF channel_posts
    FOR VALUES FROM ('2029-10-01 00:00:00+00') TO ('2029-11-01 00:00:00+00');

CREATE TABLE channel_posts_y2029m11 PARTITION OF channel_posts
    FOR VALUES FROM ('2029-11-01 00:00:00+00') TO ('2029-12-01 00:00:00+00');

CREATE TABLE channel_posts_y2029m12 PARTITION OF channel_posts
    FOR VALUES FROM ('2029-12-01 00:00:00+00') TO ('2030-01-01 00:00:00+00');

CREATE TABLE channel_posts_y2030m01 PARTITION OF channel_posts
    FOR VALUES FROM ('2030-01-01 00:00:00+00') TO ('2030-02-01 00:00:00+00');

CREATE TABLE channel_posts_y2030m02 PARTITION OF channel_posts
    FOR VALUES FROM ('2030-02-01 00:00:00+00') TO ('2030-03-01 00:00:00+00');

CREATE TABLE channel_posts_y2030m03 PARTITION OF channel_posts
    FOR VALUES FROM ('2030-03-01 00:00:00+00') TO ('2030-04-01 00:00:00+00');

CREATE TABLE channel_posts_y2030m04 PARTITION OF channel_posts
    FOR VALUES FROM ('2030-04-01 00:00:00+00') TO ('2030-05-01 00:00:00+00');

CREATE TABLE channel_posts_y2030m05 PARTITION OF channel_posts
    FOR VALUES FROM ('2030-05-01 00:00:00+00') TO ('2030-06-01 00:00:00+00');

CREATE TABLE channel_posts_y2030m06 PARTITION OF channel_posts
    FOR VALUES FROM ('2030-06-01 00:00:00+00') TO ('2030-07-01 00:00:00+00');

CREATE TABLE channel_posts_y2030m07 PARTITION OF channel_posts
    FOR VALUES FROM ('2030-07-01 00:00:00+00') TO ('2030-08-01 00:00:00+00');

CREATE TABLE channel_posts_y2030m08 PARTITION OF channel_posts
    FOR VALUES FROM ('2030-08-01 00:00:00+00') TO ('2030-09-01 00:00:00+00');

CREATE TABLE channel_posts_y2030m09 PARTITION OF channel_posts
    FOR VALUES FROM ('2030-09-01 00:00:00+00') TO ('2030-10-01 00:00:00+00');

CREATE TABLE channel_posts_y2030m10 PARTITION OF channel_posts
    FOR VALUES FROM ('2030-10-01 00:00:00+00') TO ('2030-11-01 00:00:00+00');

CREATE TABLE channel_posts_y2030m11 PARTITION OF channel_posts
    FOR VALUES FROM ('2030-11-01 00:00:00+00') TO ('2030-12-01 00:00:00+00');

CREATE TABLE channel_posts_y2030m12 PARTITION OF channel_posts
    FOR VALUES FROM ('2030-12-01 00:00:00+00') TO ('2031-01-01 00:00:00+00');

CREATE TABLE channel_posts_y2031m01 PARTITION OF channel_posts
    FOR VALUES FROM ('2031-01-01 00:00:00+00') TO ('2031-02-01 00:00:00+00');

CREATE TABLE channel_posts_y2031m02 PARTITION OF channel_posts
    FOR VALUES FROM ('2031-02-01 00:00:00+00') TO ('2031-03-01 00:00:00+00');

CREATE TABLE channel_posts_y2031m03 PARTITION OF channel_posts
    FOR VALUES FROM ('2031-03-01 00:00:00+00') TO ('2031-04-01 00:00:00+00');

CREATE TABLE channel_posts_y2031m04 PARTITION OF channel_posts
    FOR VALUES FROM ('2031-04-01 00:00:00+00') TO ('2031-05-01 00:00:00+00');

CREATE TABLE channel_posts_y2031m05 PARTITION OF channel_posts
    FOR VALUES FROM ('2031-05-01 00:00:00+00') TO ('2031-06-01 00:00:00+00');

CREATE TABLE channel_posts_y2031m06 PARTITION OF channel_posts
    FOR VALUES FROM ('2031-06-01 00:00:00+00') TO ('2031-07-01 00:00:00+00');

CREATE TABLE channel_posts_y2031m07 PARTITION OF channel_posts
    FOR VALUES FROM ('2031-07-01 00:00:00+00') TO ('2031-08-01 00:00:00+00');

CREATE TABLE channel_posts_y2031m08 PARTITION OF channel_posts
    FOR VALUES FROM ('2031-08-01 00:00:00+00') TO ('2031-09-01 00:00:00+00');

CREATE TABLE channel_posts_y2031m09 PARTITION OF channel_posts
    FOR VALUES FROM ('2031-09-01 00:00:00+00') TO ('2031-10-01 00:00:00+00');

CREATE TABLE channel_posts_y2031m10 PARTITION OF channel_posts
    FOR VALUES FROM ('2031-10-01 00:00:00+00') TO ('2031-11-01 00:00:00+00');

CREATE TABLE channel_posts_y2031m11 PARTITION OF channel_posts
    FOR VALUES FROM ('2031-11-01 00:00:00+00') TO ('2031-12-01 00:00:00+00');

CREATE TABLE channel_posts_y2031m12 PARTITION OF channel_posts
    FOR VALUES FROM ('2031-12-01 00:00:00+00') TO ('2032-01-01 00:00:00+00');
-- No default partition to prevent locking partition worker creations.

-- 4. Copy data from old table
INSERT INTO channel_posts (id, channel_id, telegram_message_id, author_user_id, text, has_media, views_count, reactions_count, forwards_count, is_pinned, scheduled_at, posted_at, created_at)
SELECT id, channel_id, telegram_message_id, author_user_id, text, has_media, views_count, reactions_count, forwards_count, is_pinned, scheduled_at, posted_at, created_at FROM channel_posts_old;

-- 5. Drop old table
DROP TABLE channel_posts_old;

-- 6. Create indexes on new partitioned table
CREATE INDEX idx_channel_posts_channel ON channel_posts(channel_id, created_at DESC);
CREATE INDEX idx_channel_posts_scheduled ON channel_posts(scheduled_at) WHERE scheduled_at IS NOT NULL AND posted_at IS NULL;

COMMIT;
