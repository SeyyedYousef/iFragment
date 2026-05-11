BEGIN;

-- =============================================
-- FRG Token Economy
-- =============================================
CREATE TABLE frg_balances (
    user_id BIGINT PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
    balance NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    total_earned NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_spent NUMERIC(18,4) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE frg_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'purchase_stars', 'purchase_toncoin', 'airdrop_convert',
        'subscription_payment', 'refund', 'admin_credit'
    )),
    amount NUMERIC(18,4) NOT NULL,
    balance_before NUMERIC(18,4) NOT NULL,
    balance_after NUMERIC(18,4) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_frg_transactions_user ON frg_transactions(user_id, created_at DESC);

-- =============================================
-- Bot Management
-- =============================================
CREATE TABLE managed_bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    bot_token_encrypted BYTEA NOT NULL,
    bot_username TEXT NOT NULL UNIQUE,
    bot_name TEXT NOT NULL,
    bot_id BIGINT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_managed_bots_owner ON managed_bots(owner_user_id);

-- =============================================
-- Group Management
-- =============================================
CREATE TABLE managed_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES managed_bots(id) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL,
    chat_title TEXT NOT NULL DEFAULT '',
    chat_type TEXT NOT NULL DEFAULT 'group' CHECK (chat_type IN ('group', 'supergroup', 'channel')),
    members_count INT NOT NULL DEFAULT 0,
    subscription_status TEXT NOT NULL DEFAULT 'trial'
        CHECK (subscription_status IN ('trial', 'paid', 'expired', 'cancelled')),
    trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
    paid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(bot_id, chat_id)
);

CREATE INDEX idx_managed_groups_bot ON managed_groups(bot_id);
CREATE INDEX idx_managed_groups_status ON managed_groups(subscription_status);

-- =============================================
-- Group Settings (JSONB per category)
-- =============================================
CREATE TABLE group_settings (
    group_id UUID PRIMARY KEY REFERENCES managed_groups(id) ON DELETE CASCADE,
    general JSONB NOT NULL DEFAULT '{}',
    content_restrictions JSONB NOT NULL DEFAULT '{}',
    limits JSONB NOT NULL DEFAULT '{}',
    quiet_hours JSONB NOT NULL DEFAULT '{}',
    mandatory_membership JSONB NOT NULL DEFAULT '{}',
    custom_texts JSONB NOT NULL DEFAULT '{}',
    version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by BIGINT REFERENCES users(telegram_id)
);

-- =============================================
-- Audit Logs
-- =============================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES managed_groups(id) ON DELETE CASCADE,
    actor_id BIGINT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    old_value JSONB,
    new_value JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_group_created ON audit_logs(group_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);

-- =============================================
-- Group Events (for Analytics)
-- =============================================
CREATE TABLE group_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES managed_groups(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'message', 'join', 'leave', 'spam_blocked', 'rule_violation',
        'member_banned', 'member_muted', 'member_kicked', 'member_warned'
    )),
    user_id BIGINT,
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_group_events_group_type ON group_events(group_id, event_type, created_at DESC);
CREATE INDEX idx_group_events_created ON group_events(created_at DESC);

-- =============================================
-- Billing & Subscriptions
-- =============================================
CREATE TABLE billing_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES managed_groups(id) ON DELETE CASCADE,
    package_id TEXT NOT NULL CHECK (package_id IN ('starter', 'basic', 'pro', 'business')),
    groups_limit INT NOT NULL DEFAULT 1,
    amount_frg NUMERIC(18,4) NOT NULL,
    period TEXT NOT NULL DEFAULT 'monthly',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_user ON billing_subscriptions(user_id, status);
CREATE INDEX idx_billing_group ON billing_subscriptions(group_id, status);

-- =============================================
-- Bot Permissions Cache
-- =============================================
CREATE TABLE bot_permissions_cache (
    bot_id UUID NOT NULL REFERENCES managed_bots(id) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{}',
    refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (bot_id, chat_id)
);

COMMIT;
