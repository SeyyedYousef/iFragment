BEGIN;

CREATE TABLE IF NOT EXISTS channel_funnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES managed_bots(id) ON DELETE CASCADE,
    input_chat_id BIGINT NOT NULL,
    output_chat_id BIGINT NOT NULL,
    owner_user_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(bot_id, input_chat_id)
);

CREATE TABLE IF NOT EXISTS pending_funnel_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funnel_id UUID NOT NULL REFERENCES channel_funnels(id) ON DELETE CASCADE,
    input_message_id BIGINT NOT NULL,
    original_author_id BIGINT,
    original_author_name TEXT,
    media_group_id TEXT,
    media_payload JSONB NOT NULL DEFAULT '[]',
    draft_text TEXT,
    draft_buttons JSONB NOT NULL DEFAULT '[]',
    ai_variations JSONB NOT NULL DEFAULT '[]',
    selected_variation_index INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'scheduled')),
    scheduled_at TIMESTAMPTZ,
    published_message_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(funnel_id, input_message_id)
);

CREATE INDEX IF NOT EXISTS idx_pending_funnel_status ON pending_funnel_posts(status, scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_channel_funnels_input ON channel_funnels(input_chat_id);
CREATE INDEX IF NOT EXISTS idx_pending_funnel_mediagroup ON pending_funnel_posts(media_group_id) WHERE media_group_id IS NOT NULL;

COMMIT;
