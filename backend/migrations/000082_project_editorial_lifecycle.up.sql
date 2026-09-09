-- 000082_project_editorial_lifecycle.up.sql
-- Decoupled Project-first Editorial Architecture: Content Items, Revisions, Approvals, Deliveries, and Team Members.

BEGIN;

-- 1. Logical content item received from source channel
CREATE TABLE IF NOT EXISTS content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_chat_id BIGINT NOT NULL,
    source_message_id BIGINT NOT NULL,
    source_media_group_id TEXT,
    status TEXT NOT NULL DEFAULT 'received' CHECK (
        status IN (
            'received', 'normalizing', 'processing', 'awaiting_review',
            'editing', 'approved', 'scheduled', 'publishing', 'published',
            'rejected', 'expired', 'blocked', 'failed_retryable', 'failed_permanent', 'cancelled'
        )
    ),
    current_revision_id UUID,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, source_chat_id, source_message_id)
);

CREATE INDEX IF NOT EXISTS idx_content_items_project_status ON content_items(project_id, status);
CREATE INDEX IF NOT EXISTS idx_content_items_media_group ON content_items(source_media_group_id) WHERE source_media_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_items_source_msg ON content_items(source_chat_id, source_message_id);

-- 2. Content Revisions: Track each transformation, AI revision, editor change, or original text
CREATE TABLE IF NOT EXISTS content_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    text TEXT,
    caption TEXT,
    entities JSONB NOT NULL DEFAULT '[]'::jsonb,
    caption_entities JSONB NOT NULL DEFAULT '[]'::jsonb,
    media_manifest JSONB NOT NULL DEFAULT '[]'::jsonb,
    buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
    transformations JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(content_item_id, version)
);

CREATE INDEX IF NOT EXISTS idx_content_revisions_item ON content_revisions(content_item_id);

-- 3. Approval Requests: Short token, bounded to project and content item
CREATE TABLE IF NOT EXISTS approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
    revision_id UUID REFERENCES content_revisions(id) ON DELETE SET NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'decided', 'expired', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_token ON approval_requests(token_hash);
CREATE INDEX IF NOT EXISTS idx_approval_requests_proj ON approval_requests(project_id, status);

-- 4. Approval Decisions: Atomic decision recording preventing race conditions
CREATE TABLE IF NOT EXISTS approval_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
    approver_user_id BIGINT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'scheduled', 'edited')),
    reason TEXT,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(request_id)
);

-- 5. Deliveries: Track strictly bot-owned publications to target channel.
-- HARD RULE: Any message in target channel NOT present here with created_by_bot = true
-- is considered an admin's manual post and will NEVER be touched/edited/deleted by the bot.
CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    content_item_id UUID REFERENCES content_items(id) ON DELETE SET NULL,
    destination_chat_id BIGINT NOT NULL,
    telegram_message_id BIGINT,
    revision_id UUID REFERENCES content_revisions(id) ON DELETE SET NULL,
    created_by_bot BOOLEAN NOT NULL DEFAULT true,
    status TEXT NOT NULL DEFAULT 'publishing' CHECK (status IN ('publishing', 'published', 'failed')),
    idempotency_key TEXT UNIQUE,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deliveries_dest_msg ON deliveries(destination_chat_id, telegram_message_id) WHERE telegram_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deliveries_project_created ON deliveries(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_content_item ON deliveries(content_item_id);

-- 6. Project Members: Role-based access control (Owner, Admin, Editor, Approver, Viewer)
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'approver', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- 7. Populate existing project owners into project_members
INSERT INTO project_members (project_id, user_id, role)
SELECT id, owner_user_id, 'owner'
FROM projects
WHERE owner_user_id IN (SELECT telegram_id FROM users)
ON CONFLICT (project_id, user_id) DO NOTHING;

-- 8. Migrate any pending funnel posts into content_items & content_revisions safely
INSERT INTO content_items (
    id,
    project_id,
    source_chat_id,
    source_message_id,
    source_media_group_id,
    status,
    received_at,
    created_at,
    updated_at
)
SELECT
    pfp.id,
    pfp.funnel_id,
    COALESCE(p.source_chat_id, 0),
    pfp.input_message_id,
    pfp.media_group_id,
    CASE
        WHEN pfp.status = 'approved' THEN 'approved'
        WHEN pfp.status = 'rejected' THEN 'rejected'
        WHEN pfp.status = 'scheduled' THEN 'scheduled'
        ELSE 'awaiting_review'
    END,
    pfp.created_at,
    pfp.created_at,
    pfp.updated_at
FROM pending_funnel_posts pfp
JOIN projects p ON p.id = pfp.funnel_id
ON CONFLICT (project_id, source_chat_id, source_message_id) DO NOTHING;

-- Insert corresponding revisions for migrated content
INSERT INTO content_revisions (
    content_item_id,
    version,
    text,
    caption,
    media_manifest,
    buttons,
    transformations,
    created_at
)
SELECT
    pfp.id,
    1,
    pfp.draft_text,
    pfp.draft_text,
    pfp.media_payload,
    pfp.draft_buttons,
    '[]'::jsonb,
    pfp.created_at
FROM pending_funnel_posts pfp
WHERE EXISTS (SELECT 1 FROM content_items ci WHERE ci.id = pfp.id)
ON CONFLICT (content_item_id, version) DO NOTHING;

-- Link current_revision_id on content_items
UPDATE content_items ci
SET current_revision_id = cr.id
FROM content_revisions cr
WHERE cr.content_item_id = ci.id AND cr.version = 1 AND ci.current_revision_id IS NULL;

-- If any migrated items had published_message_id, record them in deliveries
INSERT INTO deliveries (
    project_id,
    content_item_id,
    destination_chat_id,
    telegram_message_id,
    created_by_bot,
    status,
    idempotency_key,
    created_at,
    published_at
)
SELECT
    p.id,
    pfp.id,
    COALESCE(p.target_chat_id, 0),
    pfp.published_message_id,
    true,
    'published',
    'legacy_funnel_' || pfp.id::text,
    pfp.updated_at,
    pfp.updated_at
FROM pending_funnel_posts pfp
JOIN projects p ON p.id = pfp.funnel_id
WHERE pfp.published_message_id IS NOT NULL AND pfp.published_message_id > 0
ON CONFLICT (idempotency_key) DO NOTHING;

COMMIT;
