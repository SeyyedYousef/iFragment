package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/getsentry/sentry-go"
	sentryhttp "github.com/getsentry/sentry-go/http"
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"ifragment-backend/internal/client/mtproto"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/handler"
	"ifragment-backend/internal/logger"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/router"
	"ifragment-backend/internal/service"
	"ifragment-backend/internal/service/botmgmt"
	"ifragment-backend/internal/service/broadcaster"
	"ifragment-backend/internal/service/channelmgmt"
	"ifragment-backend/internal/service/cryptoprice"
	"ifragment-backend/internal/service/payment"
	"ifragment-backend/internal/service/username"
	"ifragment-backend/internal/service/username/avm"

	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"
	"github.com/rs/cors"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"

	"ifragment-backend/internal/telemetry"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

func main() {
	// Initialize PII Masking Logger with Tracing Support
	slog.SetDefault(slog.New(logger.NewTracingHandler(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		ReplaceAttr: logger.MaskPIIAttr,
	}))))
	log.SetOutput(&logger.PIIMaskingWriter{Out: os.Stdout})

	// Load .env file (only in non-production)
	if os.Getenv("APP_ENV") != "production" {
		if err := godotenv.Load(); err != nil {
			slog.Info("No .env file found, using system environment variables")
		}
	}

	// P0-S1: Validate critical secrets at startup (fail-fast)
	isProd := os.Getenv("APP_ENV") == "production"
	if jwtSecret := os.Getenv("JWT_SECRET"); len(jwtSecret) < 32 {
		if isProd {
			slog.Error("FATAL: JWT_SECRET must be at least 32 characters for production")
			os.Exit(1)
		}
		slog.Warn("JWT_SECRET is too short (< 32 chars), using anyway in non-production")
	}
	if isProd {
		requiredSecrets := []string{"WEBHOOK_SECRET_TOKEN", "DATABASE_URL"}
		for _, s := range requiredSecrets {
			if os.Getenv(s) == "" {
				slog.Error("FATAL: Required secret is missing in production", "secret", s)
				os.Exit(1)
			}
		}
		if os.Getenv("BOT_TOKEN") == "" && os.Getenv("TELEGRAM_BOT_TOKEN") == "" {
			slog.Error("FATAL: Required secret is missing in production", "secret", "BOT_TOKEN or TELEGRAM_BOT_TOKEN")
			os.Exit(1)
		}
	}

	ctx, cancelMain := context.WithCancel(context.Background())
	defer cancelMain()

	// Initialize OpenTelemetry Tracer
	otelShutdown, err := telemetry.InitTracer(ctx, "ifragment-api")
	if err != nil {
		slog.Error("Failed to initialize OpenTelemetry Tracer", "error", err)
	} else {
		defer func() {
			if err := otelShutdown(context.Background()); err != nil {
				slog.Error("Failed to shutdown OpenTelemetry Tracer", "error", err)
			}
		}()
		slog.Info("OpenTelemetry Tracer initialized successfully")
	}

	// Initialize Database
	db, err := repository.NewDatabase(ctx)
	if err != nil {
		if isProd {
			slog.Error("FATAL: Database connection failed in production", "error", err)
			os.Exit(1)
		}
		slog.Warn("Database connection failed, continuing without DB", "error", err)
	} else {
		defer db.Close()

		// Run Migrations with retry
		var migrationSuccess bool
		var lastMigrationErr error
		for i := 0; i < 5; i++ {
			m, mErr := migrate.New("file://./migrations", os.Getenv("DATABASE_URL"))
			if mErr == nil {
				if upErr := m.Up(); upErr != nil && upErr != migrate.ErrNoChange {
					if isProd {
						slog.Error("FATAL: Database migration failed in production", "error", upErr)
						os.Exit(1)
					}
					slog.Warn("Database migration warning", "error", upErr)
				} else {
					slog.Info("Database migrations applied successfully")
				}
				migrationSuccess = true
				break
			}
			lastMigrationErr = mErr
			slog.Info("Waiting for database to be ready for migrations...", "attempt", i+1, "error", mErr)
			time.Sleep(2 * time.Second)
		}
		if !migrationSuccess && isProd {
			slog.Error("FATAL: Database migration initialization failed in production", "error", lastMigrationErr)
			os.Exit(1)
		}
	}

	// Initialize Cache
	cache, err := repository.NewCache(ctx)
	if err != nil {
		slog.Warn("Cache connection failed, continuing without Cache", "error", err)
	} else {
		defer cache.Close()
	}

	// Initialize Crypto Price Service
	cryptoPriceService := cryptoprice.NewCryptoPriceService(cache)
	go cryptoPriceService.Start(ctx)

	// Initialize Gram Broadcaster
	botToken := os.Getenv("BOT_TOKEN")
	if botToken != "" {
		gramBroadcaster := broadcaster.NewGramBroadcaster(botToken, cryptoPriceService)
		go gramBroadcaster.Start(ctx)
	}

	// P3-S1: Initialize Server with middleware stack
	r := chi.NewRouter()

	r.Use(chiMiddleware.RealIP)
	r.Use(chiMiddleware.Recoverer)

	// Request-ID and Structured Logging
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			reqID := r.Header.Get("X-Request-ID")
			if reqID == "" {
				reqID = uuid.NewString()
			}
			w.Header().Set("X-Request-ID", reqID)
			ctx := context.WithValue(r.Context(), logger.RequestIDKey, reqID)
			reqLogger := slog.With("request_id", reqID, "path", r.URL.Path)
			ctx = context.WithValue(ctx, logger.LoggerKey, reqLogger)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	})
	r.Use(chiMiddleware.Logger)

	// Sentry Initialization (P0-S3: Handle init error)
	if err := sentry.Init(sentry.ClientOptions{
		Dsn:              os.Getenv("SENTRY_DSN"),
		TracesSampleRate: 0.1,
		Environment:      os.Getenv("APP_ENV"),
	}); err != nil {
		slog.Error("Failed to initialize Sentry", "error", err)
	}
	defer sentry.Flush(2 * time.Second)

	allowedOriginsStr := os.Getenv("ALLOWED_ORIGINS")
	if allowedOriginsStr == "" {
		if appUrl := os.Getenv("APP_URL"); appUrl != "" {
			allowedOriginsStr = appUrl
		} else {
			allowedOriginsStr = "http://localhost:5173,http://127.0.0.1:5173" // fallback for dev
		}
	}
	allowedOrigins := strings.Split(allowedOriginsStr, ",")
	allowCreds := true
	for _, o := range allowedOrigins {
		if o == "*" {
			allowCreds = false
			break
		}
	}
	c := cors.New(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Telegram-Init-Data", "X-Request-ID"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: allowCreds,
		MaxAge:           86400,
	})
	// CORS must be executed before rate limiter and auth
	r.Use(c.Handler)
	r.Use(chiMiddleware.Compress(5))

	r.Use(middleware.SecurityHeaders)

	// 1MB body limit middleware
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
			next.ServeHTTP(w, r)
		})
	})

	r.Use(middleware.NewRateLimiter(ctx, cache))
	r.Use(sentryhttp.New(sentryhttp.Options{Repanic: true}).Handle)
	r.Use(middleware.CSRF)

	// Prometheus Metrics (P1-S4: Protected with bearer token)
	r.Group(func(r chi.Router) {
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				metricsToken := os.Getenv("METRICS_TOKEN")
				if metricsToken != "" {
					auth := r.Header.Get("Authorization")
					if auth != "Bearer "+metricsToken {
						w.WriteHeader(http.StatusUnauthorized)
						return
					}
				}
				next.ServeHTTP(w, r)
			})
		})
		r.Handle("/metrics", promhttp.Handler())
	})

	// Initialize Clients
	tonClient := tonapi.NewClient()

	mtprotoClient, err := mtproto.InitClient(ctx)
	if err != nil {
		slog.Error("FATAL: Failed to initialize MTProto client", "error", err)
		os.Exit(1)
	}

	// Initialize Services
	aggregatorService := username.NewAggregatorService(tonClient, cache)
	analysisService := username.NewAnalysisService(context.Background(), db, cache, tonClient, mtprotoClient)
	paymentService := payment.NewStarsService(db)

	// Initialize Bot Management repos & services
	botRepo := repository.NewBotRepo(db)
	settingsRepo := repository.NewSettingsRepo(db, cache)
	auditRepo := repository.NewAuditRepo(db)
	analyticsRepo := repository.NewAnalyticsRepo(db)

	botService := botmgmt.NewBotService(botRepo, settingsRepo, auditRepo, analyticsRepo, cache, cryptoPriceService)
	AutoRegisterMainBot(ctx, db, botService)
	moderatorService := botmgmt.NewModeratorService(settingsRepo, botRepo, auditRepo, analyticsRepo, cache)

	// 🚀 Start Background Expiration Worker
	botService.StartBackgroundTasks(ctx)

	// 🚀 Start Background Partition & Maintenance Worker
	if db != nil {
		partitionWorker := username.NewPartitionWorker(db)
		go partitionWorker.Start(ctx)
	}

	// 🚀 Start Background Collection Stats Worker
	if db != nil && tonClient != nil {
		collectionWorker := username.NewCollectionWorker(db, tonClient)
		go collectionWorker.Start(ctx)
	}

	// Initialize Handlers
	channelRepo := repository.NewChannelRepo(db, cache)
	channelService := channelmgmt.NewChannelService(channelRepo, botRepo, auditRepo, cryptoPriceService)

	// 🚀 Start Channel Background Workers (Post scheduler & daily analytics snapshots)
	channelService.StartBackgroundTasks(ctx)

	// Initialize UserbotManager
	ownerRepo := repository.NewOwnerRepo(db)

	appIDStr := os.Getenv("TG_APP_ID")
	appID, _ := strconv.Atoi(appIDStr)
	appHash := os.Getenv("TG_APP_HASH")

	userbotManager := mtproto.NewUserbotManager(appID, appHash, channelService.ProcessChannelPostForUserbot, func(ctx context.Context, source, msg string) error {
		return ownerRepo.LogSystemError(ctx, source, msg)
	})
	channelService.SetUserbotJoiner(userbotManager.JoinChannel)

	// Fetch active userbots and start them
	bgCtx := context.Background()
	activeBots, _ := ownerRepo.GetActiveManagedUserbots(bgCtx)
	for _, b := range activeBots {
		if err := userbotManager.AddClient(bgCtx, b.PhoneNumber); err != nil {
			slog.Warn("Failed to start userbot on init", "phone", b.PhoneNumber, "err", err)
		}
	}

	channelHandler := handler.NewChannelHandler(channelService)

	avmService := avm.NewValuationService(db, cache, tonClient)

	usernameHandler := handler.NewUsernameHandler(aggregatorService, analysisService, mtprotoClient, cache, avmService, db, paymentService)

	webhookHandler := handler.NewWebhookHandler(db, moderatorService, botRepo, channelService)
	botMgmtHandler := handler.NewBotMgmtHandler(botService, paymentService)
	profileService := service.NewProfileService(db, cache)
	// 🚀 Warm up Redis leaderboard at startup and periodically
	go func() {
		_ = profileService.WarmLeaderboard(context.Background())
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				ctxWarm, cancelWarm := context.WithTimeout(context.Background(), 60*time.Second)
				_ = profileService.WarmLeaderboard(ctxWarm)
				cancelWarm()
			case <-ctx.Done():
				return
			}
		}
	}()
	profileHandler := handler.NewProfileHandler(profileService, paymentService, settingsRepo)
	gamificationService := service.NewGamificationService(db, cache)
	gamificationHandler := handler.NewGamificationHandler(gamificationService)
	clanService := service.NewClanService(db, cache, mtprotoClient, telegram.NewBotAPIClient(botToken))
	clanService.StartWeeklyUpdater(ctx)
	clanService.StartScoreFlusher(ctx)
	clanHandler := handler.NewClanHandler(clanService)

	collectionRepo := repository.NewCollectionRepo(db)
	collectionHandler := handler.NewCollectionHandler(collectionRepo)

	authHandler := handler.NewAuthHandler(db, profileService)

	// Initialize Owner components
	middleware.InitAuthMiddleware(ownerRepo)
	ownerService := service.NewOwnerService(ownerRepo, cache, settingsRepo, userbotManager)
	ownerHandler := handler.NewOwnerHandler(ownerService)

	// Base health check for external ping services (e.g. cron-job.org, Render, K8s)
	healthOK := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "ok", "message": "iFragment API is awake"}`))
	}
	r.Get("/", healthOK)
	r.Get("/health", healthOK)
	r.Get("/healthz", healthOK)
	r.Get("/ping", healthOK)

	// Static files serving (e.g., generated username card images for stories)
	r.Handle("/static/*", http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))

	// Public Health check routes
	r.Get("/api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status": "ok"}`))
	})

	r.Get("/api/v1/healthz/live", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status": "alive"}`))
	})

	r.Get("/api/v1/healthz/ready", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if db == nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte(`{"status": "unready", "db": "disconnected"}`))
			return
		}
		if err := db.Pool.Ping(r.Context()); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte(`{"status": "unready", "db": "error"}`))
			return
		}
		if cache == nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte(`{"status": "unready", "cache": "disconnected"}`))
			return
		}
		if err := cache.Client.Ping(r.Context()).Err(); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte(`{"status": "unready", "cache": "error"}`))
			return
		}

		w.Write([]byte(`{"status": "ready"}`))
	})

	r.Get("/api/v1/diagnostics/telegram", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		tgClient := &http.Client{Timeout: 5 * time.Second}
		tgResp, err := tgClient.Get("https://api.telegram.org")
		if err != nil {
			slog.Error("Telegram API health check failed", "error", err)
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte(`{"status": "unhealthy", "telegram_api": "unreachable"}`))
			return
		}
		tgResp.Body.Close()
		w.Write([]byte(`{"status": "healthy", "telegram_api": "reachable"}`))
	})

	// Register API and Owner routes via modular router package
	router.RegisterAPIRoutes(r, router.Config{
		DB:                  db,
		Cache:               cache,
		OwnerRepo:           ownerRepo,
		SettingsRepo:        settingsRepo,
		AuthHandler:         authHandler,
		UsernameHandler:     usernameHandler,
		CollectionHandler:   collectionHandler,
		BotMgmtHandler:      botMgmtHandler,
		ChannelHandler:      channelHandler,
		ProfileHandler:      profileHandler,
		GamificationHandler: gamificationHandler,
		ClanHandler:         clanHandler,
		WebhookHandler:      webhookHandler,
		OwnerHandler:        ownerHandler,
	})

	// Start server with graceful shutdown
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           otelhttp.NewHandler(r, "ifragment-api"),
		ReadTimeout:       10 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 14, // 16KB
	}

	go func() {
		slog.Info("iFragment Backend starting...", "port", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("Server failed to start", "error", err)
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("Shutting down server...")

	// Cancel the main context to stop all background goroutines (MTProto, etc.)
	cancelMain()

	ctxShut, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctxShut); err != nil {
		slog.Error("Server forced to shutdown", "error", err)
		os.Exit(1)
	}

	slog.Info("Server exiting")
}

func AutoRegisterMainBot(ctx context.Context, db *repository.Database, botService *botmgmt.BotService) {
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	if token == "" {
		token = os.Getenv("BOT_TOKEN")
	}
	if token == "" {
		slog.Warn("AutoRegisterMainBot: TELEGRAM_BOT_TOKEN/BOT_TOKEN is not set")
		return
	}

	appURL := os.Getenv("APP_URL")
	if appURL == "" {
		slog.Warn("AutoRegisterMainBot: APP_URL is not set, but continuing with DB registration")
	}

	ownerIDStr := os.Getenv("OWNER_TELEGRAM_ID")
	if ownerIDStr == "" {
		ownerIDStr = os.Getenv("OWNER_TELEGRAM_IDS")
	}
	if strings.Contains(ownerIDStr, ",") {
		ownerIDStr = strings.TrimSpace(strings.Split(ownerIDStr, ",")[0])
	}
	ownerID, err := strconv.ParseInt(ownerIDStr, 10, 64)
	if err != nil {
		slog.Error("AutoRegisterMainBot: OWNER_TELEGRAM_ID is not set or invalid, skipping webhook registration", "error", err)
		return
	}

	// Parse bot ID from token
	parts := strings.Split(token, ":")
	if len(parts) < 2 {
		slog.Error("AutoRegisterMainBot: invalid bot token format")
		return
	}
	botID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		slog.Error("AutoRegisterMainBot: failed to parse bot ID from token", "error", err)
		return
	}

	// Check if bot exists in database
	var dbID string
	var secretToken string
	err = db.Pool.QueryRow(ctx, "SELECT id, webhook_secret_token FROM managed_bots WHERE bot_id = $1", botID).Scan(&dbID, &secretToken)

	var botUUID uuid.UUID
	if err != nil {
		// Ensure owner user exists in database to prevent foreign key violation
		err = db.UpsertUser(ctx, repository.User{
			TelegramID:   ownerID,
			Username:     fmt.Sprintf("owner_%d", ownerID),
			FirstName:    "Owner",
			LastName:     "Admin",
			LanguageCode: "en",
		})
		if err != nil {
			slog.Error("AutoRegisterMainBot: failed to upsert owner user in DB", "error", err)
			return
		}

		// Bot doesn't exist, register it
		slog.Info("AutoRegisterMainBot: main bot not found in DB, registering...", "bot_id", botID)
		tgClient := telegram.NewBotAPIClient(token)
		me, err := tgClient.GetMe(ctx)
		if err != nil {
			slog.Error("AutoRegisterMainBot: failed to verify bot token with Telegram", "error", err)
			return
		}

		// Rename any incorrectly registered bot with the same username but different ID.
		// This happens if the bot username was reclaimed or transferred on Telegram.
		// We rename the old bot to avoid dropping all its associated groups and analytics via cascade deletion.
		_, err = db.Pool.Exec(ctx, "UPDATE managed_bots SET bot_username = bot_username || '_conflict_' || bot_id WHERE LOWER(bot_username) = LOWER($1) AND bot_id != $2", me.Username, botID)
		if err != nil {
			slog.Warn("AutoRegisterMainBot: failed to rename conflicting bot_username", "error", err)
		}

		bot, err := botService.RegisterBot(ctx, ownerID, token, me.Username, me.FirstName, botID)
		if err != nil {
			slog.Error("AutoRegisterMainBot: failed to register bot in database", "error", err)
			return
		}
		botUUID = bot.ID
		secretToken = bot.WebhookSecretToken
		slog.Info("AutoRegisterMainBot: main bot registered successfully", "id", bot.ID)
	} else {
		botUUID, err = uuid.Parse(dbID)
		if err != nil {
			slog.Error("AutoRegisterMainBot: failed to parse bot UUID", "error", err)
			return
		}
		slog.Info("AutoRegisterMainBot: main bot found in DB", "id", botUUID)
	}

	// Register webhook with Telegram
	backendURL := os.Getenv("BACKEND_URL")
	if backendURL == "" {
		backendURL = os.Getenv("API_URL")
	}
	if backendURL == "" {
		backendURL = appURL
	}

	if backendURL == "" {
		slog.Warn("AutoRegisterMainBot: cannot set webhook because BACKEND_URL, API_URL, and APP_URL are all empty")
		return
	}

	webhookURL := fmt.Sprintf("%s/api/v1/webhook/telegram/%s", strings.TrimSuffix(backendURL, "/"), botUUID.String())
	slog.Info("AutoRegisterMainBot: setting webhook URL", "url", webhookURL)

	tgWebhookURL := fmt.Sprintf("https://api.telegram.org/bot%s/setWebhook", token)
	payload := map[string]interface{}{
		"url":          webhookURL,
		"secret_token": secretToken,
		"allowed_updates": []string{
			"message",
			"edited_message",
			"callback_query",
			"channel_post",
			"edited_channel_post",
			"my_chat_member",
			"chat_member",
			"chat_join_request",
			"pre_checkout_query",
		},
	}
	body, _ := json.Marshal(payload)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Post(tgWebhookURL, "application/json", bytes.NewBuffer(body))
	if err != nil {
		slog.Error("AutoRegisterMainBot: failed to set webhook on Telegram", "error", err)
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		slog.Error("AutoRegisterMainBot: Telegram returned error when setting webhook", "status", resp.StatusCode, "body", string(respBody))
	} else {
		slog.Info("AutoRegisterMainBot: webhook set successfully on Telegram", "response", string(respBody))
	}
}
