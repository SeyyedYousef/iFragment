BEGIN;

-- =============================================
-- Managed Channels
-- =============================================
CREATE TABLE managed_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES managed_bots(id) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL,
    chat_title TEXT NOT NULL DEFAULT '',
    subscribers_count INT NOT NULL DEFAULT 0,
    subscription_status TEXT NOT NULL DEFAULT 'trial'
        CHECK (subscription_status IN ('trial', 'paid', 'expired', 'cancelled')),
    trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '72 hours'),
    paid_until TIMESTAMPTZ,
    linked_chat_id BIGINT,
    slow_mode_delay INT DEFAULT 0,
    auto_delete_time INT DEFAULT 0,
    sign_messages BOOLEAN DEFAULT false,
    protect_content BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(bot_id, chat_id)
);

CREATE INDEX idx_managed_channels_bot ON managed_channels(bot_id);
CREATE INDEX idx_managed_channels_status ON managed_channels(subscription_status);
CREATE UNIQUE INDEX idx_managed_channels_chat_id ON managed_channels(chat_id) WHERE deleted_at IS NULL;

-- =============================================
-- Channel Settings (6 JSONB Columns)
-- =============================================
CREATE TABLE channel_settings (
    channel_id UUID PRIMARY KEY REFERENCES managed_channels(id) ON DELETE CASCADE,
    general JSONB NOT NULL DEFAULT '{}',
    posting JSONB NOT NULL DEFAULT '{}',
    forwarding JSONB NOT NULL DEFAULT '{}',
    inline_buttons JSONB NOT NULL DEFAULT '{}',
    dynamic_bio JSONB NOT NULL DEFAULT '{}',
    auto_responder JSONB NOT NULL DEFAULT '{}',
    version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by BIGINT REFERENCES users(telegram_id)
);

-- =============================================
-- Channel Posts
-- =============================================
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

CREATE INDEX idx_channel_posts_channel ON channel_posts(channel_id, created_at DESC);
CREATE INDEX idx_channel_posts_scheduled ON channel_posts(scheduled_at) WHERE scheduled_at IS NOT NULL AND posted_at IS NULL;

-- =============================================
-- Channel Billing & Subscriptions
-- =============================================
CREATE TABLE channel_billing_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES managed_channels(id) ON DELETE CASCADE,
    package_id TEXT NOT NULL CHECK (package_id IN ('starter', 'basic', 'pro', 'business')),
    channels_limit INT NOT NULL DEFAULT 1,
    amount_frg NUMERIC(18,4) NOT NULL,
    period TEXT NOT NULL DEFAULT 'monthly',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_channel_billing_user ON channel_billing_subscriptions(user_id, status);
CREATE INDEX idx_channel_billing_channel ON channel_billing_subscriptions(channel_id, status);

COMMIT;
