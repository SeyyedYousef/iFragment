-- 000095_telegram_webhook_inbox.up.sql
BEGIN;

CREATE TABLE IF NOT EXISTS telegram_webhook_inbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL,
    update_id BIGINT NOT NULL,
    chat_id BIGINT,
    payload_hash VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'received',
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    lease_expires_at TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_webhook_inbox_bot_update UNIQUE (bot_id, update_id),
    CONSTRAINT chk_webhook_inbox_status CHECK (status IN ('received', 'processing', 'processed', 'failed', 'dlq'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_inbox_status_lease 
ON telegram_webhook_inbox(status, lease_expires_at);

CREATE INDEX IF NOT EXISTS idx_webhook_inbox_bot_update 
ON telegram_webhook_inbox(bot_id, update_id);

CREATE INDEX IF NOT EXISTS idx_webhook_inbox_chat 
ON telegram_webhook_inbox(chat_id, created_at DESC);

COMMIT;
