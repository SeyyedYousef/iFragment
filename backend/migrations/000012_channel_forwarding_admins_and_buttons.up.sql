BEGIN;

-- =============================================
-- Channel Forwarding Rules Table
-- =============================================
CREATE TABLE channel_forwarding_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES managed_channels(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    target_type TEXT NOT NULL CHECK (target_type IN ('telegram', 'webhook')),
    target TEXT NOT NULL,
    source_channel TEXT NOT NULL DEFAULT '',
    target_channel TEXT NOT NULL DEFAULT '',
    mode TEXT NOT NULL DEFAULT 'forward' CHECK (mode IN ('forward', 'copy', 'ai')),
    delay TEXT DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT true,
    content_types JSONB NOT NULL DEFAULT '{"text": true, "photos": true, "videos": true, "files": true, "voice": true}',
    remove_ads BOOLEAN NOT NULL DEFAULT false,
    remove_hashtags BOOLEAN NOT NULL DEFAULT false,
    remove_links BOOLEAN NOT NULL DEFAULT false,
    watermark TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_channel_forwarding_channel ON channel_forwarding_rules(channel_id);

-- =============================================
-- Channel Syncable Admins Table
-- =============================================
CREATE TABLE channel_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES managed_channels(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL,
    username TEXT,
    first_name TEXT NOT NULL,
    custom_title TEXT,
    is_owner BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(channel_id, telegram_id)
);

CREATE INDEX idx_channel_admins_channel ON channel_admins(channel_id);

-- =============================================
-- Channel Click-Trackable Inline Buttons Table
-- =============================================
CREATE TABLE channel_inline_buttons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES managed_channels(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    value TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('url', 'counter', 'share', 'webapp', 'payment')),
    style TEXT NOT NULL DEFAULT 'default',
    emoji TEXT DEFAULT '',
    click_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_channel_inline_buttons_channel ON channel_inline_buttons(channel_id);

COMMIT;
