-- 000069_projects_architecture_migration.up.sql
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

-- Migrate existing channel_funnels into projects table
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
    COALESCE(NULLIF(f.project_name, ''), 'Migrated Project') as name,
    CASE 
        WHEN f.is_active = false THEN 'paused'
        WHEN mc.subscription_status IN ('pro', 'enterprise') OR (mc.paid_until IS NOT NULL AND mc.paid_until > now()) THEN 'active'
        WHEN mc.trial_ends_at IS NOT NULL AND mc.trial_ends_at > now() THEN 'active'
        ELSE 'active' -- Initial grace status for active funnel migration
    END as status,
    CASE 
        WHEN mc.subscription_status IN ('pro', 'enterprise') OR (mc.paid_until IS NOT NULL AND mc.paid_until > now()) THEN true
        ELSE false
    END as stars_subscription_active,
    mc.paid_until as stars_expires_at,
    CASE WHEN mc.trial_ends_at IS NOT NULL THEN true ELSE false END as trial_used,
    mc.trial_ends_at,
    (SELECT id FROM managed_channels WHERE chat_id = f.input_chat_id LIMIT 1) as source_channel_id,
    f.channel_id as target_channel_id,
    f.input_chat_id as source_chat_id,
    f.output_chat_id as target_chat_id,
    json_build_object(
        'bot_id', f.bot_id,
        'schedule_delay_sec', f.schedule_delay_sec,
        'drop_media', f.drop_media,
        'remove_links', f.remove_links,
        'remove_hashtags', f.remove_hashtags,
        'remove_ads', f.remove_ads,
        'watermark', f.watermark,
        'custom_header', f.custom_header,
        'custom_footer', f.custom_footer,
        'instant_approval_required', f.instant_approval_required
    )::jsonb as pipeline_config,
    f.created_at,
    f.updated_at
FROM channel_funnels f
LEFT JOIN managed_channels mc ON mc.id = f.channel_id
ON CONFLICT (id) DO NOTHING;

-- Record audit log for data migration
INSERT INTO audit_logs (
    actor_id,
    action,
    details,
    created_at
) VALUES (
    0,
    'system.migration.funnels_to_projects',
    '{"description": "Migrated existing channel funnels into independent project architecture"}',
    now()
);
