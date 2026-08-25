-- 000074_projects_architecture_migration.up.sql (originally mis-numbered 000069)
-- Create projects table to transition from channel-bound funnels to independent project subscription model

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active, expired, cancelled, paused
    stars_subscription_active BOOLEAN NOT NULL DEFAULT false,
    stars_expires_at TIMESTAMPTZ,
    trial_used BOOLEAN NOT NULL DEFAULT false,
    trial_ends_at TIMESTAMPTZ,
    source_channel_id UUID REFERENCES managed_channels(id) ON DELETE SET NULL,
    target_channel_id UUID REFERENCES managed_channels(id) ON DELETE SET NULL,
    source_chat_id BIGINT,
    target_chat_id BIGINT,
    pipeline_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_source_chat ON projects(source_chat_id);
CREATE INDEX IF NOT EXISTS idx_projects_target_chat ON projects(target_chat_id);

-- Migrate existing channel_funnels into projects table.
--
-- NOTE: channel_funnels has NO channel_id column; its real columns are
-- id, bot_id, input_chat_id, output_chat_id, owner_user_id, is_active,
-- project_name, created_at, updated_at.
-- Subscription state lives on managed_channels keyed by (bot_id, chat_id),
-- so resolve it via LATERAL, preferring the input channel and falling back
-- to the output channel. pipeline_config keeps only fields that actually
-- exist on channel_funnels.
INSERT INTO projects (
    id,
    owner_user_id,
    name,
    status,
    stars_subscription_active,
    stars_expires_at,
    trial_used,
    trial_ends_at,
    source_channel_id,
    target_channel_id,
    source_chat_id,
    target_chat_id,
    pipeline_config,
    created_at,
    updated_at
)
SELECT
    f.id,
    f.owner_user_id,
    COALESCE(NULLIF(f.project_name, ''), 'Migrated Project') AS name,
    CASE
        WHEN f.is_active = false THEN 'paused'
        ELSE 'active' -- initial grace status for active funnel migration
    END AS status,
    CASE
        WHEN mc.subscription_status = 'paid' OR (mc.paid_until IS NOT NULL AND mc.paid_until > now()) THEN true
        ELSE false
    END AS stars_subscription_active,
    mc.paid_until AS stars_expires_at,
    CASE WHEN mc.trial_ends_at IS NOT NULL AND mc.trial_ends_at > now() THEN true ELSE false END AS trial_used,
    mc.trial_ends_at,
    (SELECT id FROM managed_channels WHERE chat_id = f.input_chat_id LIMIT 1) AS source_channel_id,
    (SELECT id FROM managed_channels WHERE chat_id = f.output_chat_id LIMIT 1) AS target_channel_id,
    f.input_chat_id AS source_chat_id,
    f.output_chat_id AS target_chat_id,
    json_build_object(
        'bot_id', f.bot_id
    )::jsonb AS pipeline_config,
    f.created_at,
    f.updated_at
FROM channel_funnels f
LEFT JOIN LATERAL (
    SELECT c.*
    FROM managed_channels c
    WHERE c.deleted_at IS NULL
      AND c.bot_id = f.bot_id
      AND c.chat_id IN (f.input_chat_id, f.output_chat_id)
    ORDER BY CASE WHEN c.chat_id = f.input_chat_id THEN 0 ELSE 1 END
    LIMIT 1
) mc ON true
ON CONFLICT (id) DO NOTHING;

-- Record audit log for data migration (audit_logs uses `metadata`, not `details`)
INSERT INTO audit_logs (
    actor_id,
    action,
    metadata,
    created_at
) VALUES (
    0,
    'system.migration.funnels_to_projects',
    '{"description": "Migrated existing channel funnels into independent project architecture"}'::jsonb,
    now()
);
