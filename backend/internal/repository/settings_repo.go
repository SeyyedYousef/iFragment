package repository

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"ifragment-backend/internal/model"

	"github.com/jackc/pgx/v5"
)

type SettingsRepo struct {
	db    *Database
	cache *Cache
}

func NewSettingsRepo(db *Database, cache *Cache) *SettingsRepo {
	return &SettingsRepo{db: db, cache: cache}
}

func (r *SettingsRepo) ClearCacheKey(ctx context.Context, key string) {
	if r.cache != nil && r.cache.Client != nil {
		r.cache.Client.Del(ctx, key)
	}
}

// System Settings Management
func (r *SettingsRepo) GetSystemSettings(ctx context.Context) (*model.SystemSettings, error) {
	cacheKey := "system_settings:global"
	if r.cache != nil && r.cache.Client != nil {
		val, err := r.cache.Client.Get(ctx, cacheKey).Result()
		if err == nil {
			var s model.SystemSettings
			if json.Unmarshal([]byte(val), &s) == nil {
				return &s, nil
			}
		}
	}

	if r.db == nil || r.db.Pool == nil {
		return defaultSystemSettings(), nil
	}

	query := `SELECT value, COALESCE(version, 1) FROM system_settings WHERE key = 'global'`
	var b []byte
	var version int
	err := r.db.Pool.QueryRow(ctx, query).Scan(&b, &version)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return defaultSystemSettings(), nil
		}
		return nil, err
	}

	var s model.SystemSettings
	if err := json.Unmarshal(b, &s); err != nil {
		return nil, err
	}
	s.Version = version

	if r.cache != nil && r.cache.Client != nil {
		data, _ := json.Marshal(s)
		r.cache.Client.Set(ctx, cacheKey, string(data), 5*time.Minute)
	}

	return &s, nil
}

func defaultSystemSettings() *model.SystemSettings {
	return &model.SystemSettings{
		MaintenanceMode:      false,
		TapMultiplier:        1.0,
		ReferralBonus:        1000,
		DailyRewardBase:      500,
		FatigueThreshold1:    200,
		FatigueThreshold2:    500,
		FatigueThreshold3:    1000,
		TapBotCapSeconds:     43200, // 12h
		ReferralRevSharePct:  10.0,
		CoinDecayPct:         0.5,
		CoinExpiryDays:       90,
		TurboDurationSeconds: 20,
		InflationCap:         100000000.0,
		Version:              1,
	}
}

func (r *SettingsRepo) UpdateSystemSettings(ctx context.Context, settings *model.SystemSettings) error {
	var currentVersion int
	queryCheck := `SELECT COALESCE(version, 1) FROM system_settings WHERE key = 'global'`
	err := r.db.Pool.QueryRow(ctx, queryCheck).Scan(&currentVersion)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	if currentVersion > 0 && settings.Version > 0 && settings.Version != currentVersion {
		return errors.New("OPTIMISTIC_LOCK_CONFLICT: settings have been modified by another administrator. Please refresh the page and apply your changes again.")
	}

	nextVersion := currentVersion + 1
	settings.Version = nextVersion

	b, err := json.Marshal(settings)
	if err != nil {
		return err
	}
	query := `
		INSERT INTO system_settings (key, value, version, updated_at)
		VALUES ('global', $1, $2, CURRENT_TIMESTAMP)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, version = $2, updated_at = CURRENT_TIMESTAMP
	`
	_, err = r.db.Pool.Exec(ctx, query, b, nextVersion)
	if err == nil && r.cache != nil && r.cache.Client != nil {
		r.cache.Client.Del(ctx, "system_settings:global")
		r.cache.Client.Del(ctx, "investors_page:config")
	}
	return err
}

func (r *SettingsRepo) GetInvestorsPageConfig(ctx context.Context) (*model.InvestorsPageConfig, error) {
	cacheKey := "investors_page:config"
	if r.cache != nil && r.cache.Client != nil {
		val, err := r.cache.Client.Get(ctx, cacheKey).Result()
		if err == nil {
			var cfg model.InvestorsPageConfig
			if json.Unmarshal([]byte(val), &cfg) == nil {
				return &cfg, nil
			}
		}
	}

	if r.db == nil || r.db.Pool == nil {
		return &model.InvestorsPageConfig{
			ImageURL:  "",
			UpdatedAt: nil,
		}, nil
	}

	query := `SELECT value, updated_at FROM system_settings WHERE key = 'global'`
	var b []byte
	var updatedAt *time.Time
	err := r.db.Pool.QueryRow(ctx, query).Scan(&b, &updatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return &model.InvestorsPageConfig{
				ImageURL:  "",
				UpdatedAt: nil,
			}, nil
		}
		return nil, err
	}

	var s model.SystemSettings
	if err := json.Unmarshal(b, &s); err != nil {
		return nil, err
	}

	cfg := &model.InvestorsPageConfig{
		ImageURL:  s.InvestorsPageImageURL,
		UpdatedAt: updatedAt,
	}
	if cfg.ImageURL == "" {
		cfg.UpdatedAt = nil
	}

	if r.cache != nil && r.cache.Client != nil {
		data, _ := json.Marshal(cfg)
		r.cache.Client.Set(ctx, cacheKey, string(data), 5*time.Minute)
	}

	return cfg, nil
}
