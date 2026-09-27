package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// BotCustomTemplate represents a custom text or button label configured by the bot owner.
type BotCustomTemplate struct {
	TemplateKey  string    `json:"template_key"`
	Language     string    `json:"language"`
	TemplateType string    `json:"template_type"` // "text" or "button"
	Content      string    `json:"content"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// BotTemplateRepo handles persistence and caching of bot custom texts and button labels.
type BotTemplateRepo struct {
	db    *Database
	cache *Cache
}

func NewBotTemplateRepo(db *Database, cache *Cache) *BotTemplateRepo {
	return &BotTemplateRepo{
		db:    db,
		cache: cache,
	}
}

func (r *BotTemplateRepo) cacheKey(key, lang string) string {
	return fmt.Sprintf("bot_tpl:%s:%s", lang, key)
}

// GetTemplate retrieves custom content if configured, or empty string if not found.
func (r *BotTemplateRepo) GetTemplate(ctx context.Context, key, lang string) (string, error) {
	if r == nil {
		return "", nil
	}

	cKey := r.cacheKey(key, lang)
	if r.cache != nil && r.cache.Client != nil {
		val, err := r.cache.Client.Get(ctx, cKey).Result()
		if err == nil {
			return val, nil
		}
	}

	if r.db == nil || r.db.Pool == nil {
		return "", nil
	}

	query := `SELECT content FROM bot_custom_templates WHERE template_key = $1 AND language = $2`
	var content string
	err := r.db.Pool.QueryRow(ctx, query, key, lang).Scan(&content)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", nil
		}
		return "", err
	}

	if r.cache != nil && r.cache.Client != nil {
		_ = r.cache.Client.Set(ctx, cKey, content, 24*time.Hour).Err()
	}

	return content, nil
}

// SetTemplate inserts or updates custom content for a key and language.
func (r *BotTemplateRepo) SetTemplate(ctx context.Context, key, lang, templateType, content string) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database unavailable")
	}

	query := `
		INSERT INTO bot_custom_templates (template_key, language, template_type, content, updated_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (template_key, language) DO UPDATE SET
			template_type = EXCLUDED.template_type,
			content = EXCLUDED.content,
			updated_at = NOW()
	`
	_, err := r.db.Pool.Exec(ctx, query, key, lang, templateType, content)
	if err != nil {
		return err
	}

	if r.cache != nil && r.cache.Client != nil {
		_ = r.cache.Client.Set(ctx, r.cacheKey(key, lang), content, 24*time.Hour).Err()
	}

	return nil
}

// DeleteTemplate removes a custom template, reverting to system defaults.
func (r *BotTemplateRepo) DeleteTemplate(ctx context.Context, key, lang string) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database unavailable")
	}

	query := `DELETE FROM bot_custom_templates WHERE template_key = $1 AND language = $2`
	_, err := r.db.Pool.Exec(ctx, query, key, lang)
	if err != nil {
		return err
	}

	if r.cache != nil && r.cache.Client != nil {
		_ = r.cache.Client.Del(ctx, r.cacheKey(key, lang)).Err()
	}

	return nil
}
