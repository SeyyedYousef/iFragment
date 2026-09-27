-- 000099_bot_custom_templates.up.sql
BEGIN;

CREATE TABLE IF NOT EXISTS bot_custom_templates (
    template_key VARCHAR(64) NOT NULL,
    language VARCHAR(10) NOT NULL,
    template_type VARCHAR(16) NOT NULL DEFAULT 'text', -- 'text' or 'button'
    content TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (template_key, language)
);

CREATE INDEX IF NOT EXISTS idx_bot_custom_templates_lang_type 
    ON bot_custom_templates(language, template_type);

COMMIT;
