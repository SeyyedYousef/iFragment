CREATE TABLE IF NOT EXISTS channel_post_clicks (
    channel_id UUID NOT NULL REFERENCES managed_channels(id) ON DELETE CASCADE,
    telegram_message_id BIGINT NOT NULL,
    button_id UUID NOT NULL REFERENCES channel_inline_buttons(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (channel_id, telegram_message_id, button_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_post_clicks_msg ON channel_post_clicks(channel_id, telegram_message_id);
