package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"
)

type Config struct {
	App      AppConfig
	DB       DatabaseConfig
	Redis    RedisConfig
	Security SecurityConfig
	Telegram TelegramConfig
	TON      TONConfig
}

type AppConfig struct {
	Env            string
	Port           string
	AppURL         string
	BackendURL     string
	MiniAppURL     string
	AllowedOrigins []string
	AllowDevBypass bool
}

func (a AppConfig) IsProduction() bool {
	return a.Env == "production" || a.Env == "prod"
}

type DatabaseConfig struct {
	URL      string
	MaxConns int
}

type RedisConfig struct {
	URL      string
	Disabled bool
}

type SecurityConfig struct {
	JWTSecret             string
	BotTokenKey           string
	CertificateSigningKey string
	WebhookSecretToken    string
	MetricsToken          string
}

type TelegramConfig struct {
	BotToken        string
	APIURL          string
	OwnerTelegramID int64
}

type TONConfig struct {
	APIKeys       []string
	WebhookSecret string
}

var (
	globalConfig *Config
	configOnce   sync.Once
)

// Load reads and parses all configuration from the environment, validating required fields in production.
func Load() (*Config, error) {
	var loadErr error
	configOnce.Do(func() {
		cfg := &Config{}

		// App Configuration
		env := strings.ToLower(getEnv("APP_ENV", getEnv("GO_ENV", "development")))
		port := getEnv("PORT", "8080")
		appURL := getEnv("APP_URL", "http://localhost:5173")
		backendURL := getEnv("BACKEND_URL", getEnv("API_URL", "http://localhost:8080"))
		miniAppURL := getEnv("MINI_APP_URL", "https://t.me/iFragmentBot/app")

		allowedOriginsStr := getEnv("ALLOWED_ORIGINS", "")
		if allowedOriginsStr == "" {
			allowedOriginsStr = "http://localhost:5173,http://127.0.0.1:5173"
		}
		allowedOrigins := strings.Split(allowedOriginsStr, ",")

		allowDevBypass := false
		if env != "production" {
			allowDevBypass = getEnv("BYPASS_TELEGRAM_AUTH", "false") == "true"
		}

		cfg.App = AppConfig{
			Env:            env,
			Port:           port,
			AppURL:         appURL,
			BackendURL:     backendURL,
			MiniAppURL:     miniAppURL,
			AllowedOrigins: allowedOrigins,
			AllowDevBypass: allowDevBypass,
		}

		// Database Configuration
		dbURL := getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/ifragment?sslmode=disable")
		maxConns := 20
		if maxConnsStr := os.Getenv("DB_MAX_CONNS"); maxConnsStr != "" {
			if parsed, err := strconv.Atoi(maxConnsStr); err == nil && parsed > 0 {
				maxConns = parsed
			}
		}
		cfg.DB = DatabaseConfig{
			URL:      dbURL,
			MaxConns: maxConns,
		}

		// Redis / Dragonfly Configuration
		redisURL := getEnv("DRAGONFLY_URL", getEnv("REDIS_URL", "redis://localhost:6379/0"))
		redisDisabled := getEnv("DISABLE_REDIS", "false") == "true"
		cfg.Redis = RedisConfig{
			URL:      redisURL,
			Disabled: redisDisabled,
		}

		// Security Configuration
		jwtSecret := getEnv("JWT_SECRET", "")
		botTokenKey := getEnv("BOT_TOKEN_KEY", "")
		certKey := getEnv("CERTIFICATE_SIGNING_KEY", getEnv("HMAC_SECRET", ""))
		webhookSecret := getEnv("WEBHOOK_SECRET_TOKEN", "")
		metricsToken := getEnv("METRICS_TOKEN", "")

		if cfg.App.IsProduction() {
			if len(jwtSecret) < 32 {
				loadErr = fmt.Errorf("CRITICAL CONFIG ERROR: JWT_SECRET must be at least 32 characters in production")
				return
			}
			if botTokenKey == "" {
				loadErr = fmt.Errorf("CRITICAL CONFIG ERROR: BOT_TOKEN_KEY must be set in production")
				return
			}
			if os.Getenv("DATABASE_URL") == "" {
				loadErr = fmt.Errorf("CRITICAL CONFIG ERROR: DATABASE_URL must be set in production")
				return
			}
			if webhookSecret == "" {
				loadErr = fmt.Errorf("CRITICAL CONFIG ERROR: WEBHOOK_SECRET_TOKEN must be set in production")
				return
			}
		}

		cfg.Security = SecurityConfig{
			JWTSecret:             jwtSecret,
			BotTokenKey:           botTokenKey,
			CertificateSigningKey: certKey,
			WebhookSecretToken:    webhookSecret,
			MetricsToken:          metricsToken,
		}

		// Telegram Configuration
		botToken := getEnv("TELEGRAM_BOT_TOKEN", getEnv("BOT_TOKEN", ""))
		tgAPIURL := getEnv("TELEGRAM_API_URL", "https://api.telegram.org")
		var ownerID int64
		if ownerIDStr := os.Getenv("OWNER_TELEGRAM_ID"); ownerIDStr != "" {
			ownerID, _ = strconv.ParseInt(ownerIDStr, 10, 64)
		}

		cfg.Telegram = TelegramConfig{
			BotToken:        botToken,
			APIURL:          tgAPIURL,
			OwnerTelegramID: ownerID,
		}

		// TON Configuration
		var tonKeys []string
		if keysStr := os.Getenv("TONAPI_KEYS"); keysStr != "" {
			tonKeys = strings.Split(keysStr, ",")
		} else if singleKey := os.Getenv("TONAPI_KEY"); singleKey != "" {
			tonKeys = []string{singleKey}
		}

		cfg.TON = TONConfig{
			APIKeys:       tonKeys,
			WebhookSecret: os.Getenv("TONAPI_WEBHOOK_SECRET"),
		}

		globalConfig = cfg
	})

	if loadErr != nil {
		return nil, loadErr
	}
	return globalConfig, nil
}

// Get returns the loaded configuration singleton or loads it with defaults if not already initialized.
func Get() *Config {
	if globalConfig == nil {
		cfg, _ := Load()
		return cfg
	}
	return globalConfig
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
