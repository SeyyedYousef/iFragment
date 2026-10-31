package main

import (
	"bytes"
	"context"
	cryptoRand "crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/getsentry/sentry-go"
	sentryhttp "github.com/getsentry/sentry-go/http"
	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/cors"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"

	"ifragment-backend/internal/client/mtproto"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/config"
	"ifragment-backend/internal/crypto"
	"ifragment-backend/internal/handler"
	"ifragment-backend/internal/logger"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/router"
	"ifragment-backend/internal/service"
	"ifragment-backend/internal/service/broadcaster"
	"ifragment-backend/internal/service/cardgen"
	"ifragment-backend/internal/service/cryptoprice"
	"ifragment-backend/internal/service/gifts"
	"ifragment-backend/internal/service/intelcredit"
	"ifragment-backend/internal/service/numbers"
	numbersindexer "ifragment-backend/internal/service/numbers/indexer"
	"ifragment-backend/internal/service/payment"
	"ifragment-backend/internal/service/raffle"
	"ifragment-backend/internal/service/username"
	"ifragment-backend/internal/service/username/avm"
	"ifragment-backend/internal/telemetry"
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

	// Guard: If deployed on legacy Render.com environment, run in dormant standby mode
	// so Render's health check succeeds (replacing any zombie container) without starting
	// GramBroadcaster or hijacking the Telegram Bot webhook from the primary VPS.
	if isLegacyRenderEnv() {
		runDormantRenderStandby()
		return
	}

	// Load and validate typed configuration
	cfg, err := config.Load()
	if err != nil {
		slog.Error("FATAL: Failed to load application configuration", "error", err)
		os.Exit(1)
	}

	isProd := cfg.App.IsProduction()

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
	db, err := repository.NewDatabaseWithConfig(ctx, cfg.DB)
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
				v, dirty, vErr := m.Version()
				if vErr == nil && dirty {
					slog.Error("CRITICAL FATAL: Database migration is in a DIRTY state! Automatic schema forcing is disabled to prevent schema corruption.",
						"version", v,
						"runbook", "Check failed migration DDL, verify database state, fix manually or run one-shot migration job before restarting.")
					if isProd {
						os.Exit(1)
					}
					if os.Getenv("AUTO_FORCE_DIRTY_MIGRATION") == "true" {
						targetVersion := int(v - 1)
						if v == 0 {
							targetVersion = 0
						}
						slog.Warn("⚠️ AUTO_FORCE_DIRTY_MIGRATION enabled in non-production: forcing version...", "version", v, "force_version", targetVersion)
						if fErr := m.Force(targetVersion); fErr != nil {
							slog.Error("Failed to force clean migration version", "error", fErr, "target_version", targetVersion)
						}
					} else {
						slog.Error("Halting startup due to dirty migration. Set AUTO_FORCE_DIRTY_MIGRATION=true only for local throwaway dev databases.")
						os.Exit(1)
					}
				}

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
	if botToken == "" {
		botToken = os.Getenv("TELEGRAM_BOT_TOKEN")
	}
	if botToken != "" {
		gramBroadcaster := broadcaster.NewGramBroadcaster(botToken, cryptoPriceService)
		gramBroadcaster.SetCache(cache)
		go gramBroadcaster.Start(ctx)
	}

	// Initialize Server with middleware stack
	r := chi.NewRouter()

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

	// Sentry Initialization
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
			allowedOriginsStr = "http://localhost:5173,http://127.0.0.1:5173"
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
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Telegram-Init-Data", "X-Request-ID", "Idempotency-Key"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: allowCreds,
		MaxAge:           86400,
	})
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

	// Prometheus Metrics (Protected with bearer token)
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

	// Initialize Services (bound to cancellable main ctx)
	aggregatorService := username.NewAggregatorService(tonClient, cache)
	analysisService := username.NewAnalysisService(ctx, db, cache, tonClient, mtprotoClient)
	paymentService := payment.NewStarsService(db)

	// Initialize Repositories
	botRepo := repository.NewBotRepo(db)
	settingsRepo := repository.NewSettingsRepo(db, cache)
	AutoRegisterMainBot(ctx, db, botRepo)
	go StartWebhookGuardian(ctx, db, botRepo)

	// Start Background Partition & Maintenance Worker
	if db != nil {
		partitionWorker := username.NewPartitionWorker(db)
		go partitionWorker.Start(ctx)
	}

	// Start Background Collection Stats Worker (single unified instance)
	if db != nil && tonClient != nil {
		collectionWorker := username.NewCollectionWorker(db, tonClient)
		go collectionWorker.Start(ctx)
	}

	// Initialize UserbotManager
	ownerRepo := repository.NewOwnerRepo(db)

	appIDStr := os.Getenv("TG_APP_ID")
	appID, _ := strconv.Atoi(appIDStr)
	appHash := os.Getenv("TG_APP_HASH")

	userbotManager := mtproto.NewUserbotManager(appID, appHash, nil, func(ctx context.Context, source, msg string) error {
		return ownerRepo.LogSystemError(ctx, source, msg)
	})

	activeBots, _ := ownerRepo.GetActiveManagedUserbots(ctx)
	for _, b := range activeBots {
		if err := userbotManager.AddClient(ctx, b.PhoneNumber); err != nil {
			slog.Warn("Failed to start userbot on init", "phone", b.PhoneNumber, "err", err)
		}
	}

	avmService := avm.NewValuationService(db, cache, tonClient)
	if cryptoPriceService != nil {
		avmService.SetCryptoPriceService(cryptoPriceService)
		analysisService.SetCryptoPriceService(cryptoPriceService)
	}

	usernameHandler := handler.NewUsernameHandler(aggregatorService, analysisService, mtprotoClient, cache, avmService, db, paymentService)

	// Initialize Group Gate Services for @FragmentInvestors
	premiumGroupSvc := raffle.NewPremiumGroupService()

	webhookHandler := handler.NewWebhookHandler(db, cache, botRepo, premiumGroupSvc)
	profileService := service.NewProfileService(db, cache)
	profileHandler := handler.NewProfileHandler(profileService, paymentService, settingsRepo, ownerRepo)

	collectionRepo := repository.NewCollectionRepo(db)
	collectionHandler := handler.NewCollectionHandler(collectionRepo, cryptoPriceService)

	authHandler := handler.NewAuthHandler(db, cache, profileService)

	// Initialize Owner components
	middleware.InitAuthMiddleware(ownerRepo)
	ownerService := service.NewOwnerService(ownerRepo, cache, settingsRepo, userbotManager)
	if ownerService.GetBroadcastWorker() != nil {
		go ownerService.GetBroadcastWorker().Start(ctx)
	}
	ownerHandler := handler.NewOwnerHandler(ownerService)

	// Base health check for external ping services
	healthOK := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "ok", "message": "iFragment API is awake"}`))
	}
	r.Get("/", healthOK)
	r.Get("/health", healthOK)
	r.Get("/healthz", healthOK)
	r.Get("/ping", healthOK)

	// Static files serving
	_ = os.MkdirAll("./static", 0755)
	_ = os.MkdirAll("./uploads/ads", 0755)
	r.Handle("/static/*", http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))
	r.Handle("/uploads/*", http.StripPrefix("/uploads/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		http.FileServer(http.Dir("./uploads")).ServeHTTP(w, r)
	})))

	r.Get("/api/v1/healthz/live", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status": "alive"}`))
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

	// Initialize Numbers Vertical (Vertical 2)
	numbersService := numbers.NewNumbersService(db, cache, tonClient, cryptoPriceService)
	numbersHandler := handler.NewNumbersHandler(numbersService)

	// Start Background Numbers Sales Indexer
	if db != nil && tonClient != nil {
		numbersSalesIndexer := numbersindexer.NewNumbersSalesIndexer(tonClient, db, cryptoPriceService)
		numbersSalesIndexer.StartBackgroundLoop(ctx, 30*time.Second)
	}

	// Initialize Gifts Vertical (Vertical 3)
	giftsService := gifts.NewGiftsService(db, cache, cryptoPriceService)
	if botToken != "" {
		giftsService.SetTelegramClient(telegram.NewBotAPIClient(botToken))
	}
	if mtprotoClient != nil {
		giftsService.SetMTProtoClient(mtprotoClient)
	}
	if webhookHandler != nil {
		webhookHandler.SetGiftsService(giftsService)
		if mtprotoClient != nil {
			webhookHandler.SetMTProtoClient(mtprotoClient)
		}
	}
	if giftsService.GetSnapshotWorker() != nil {
		go giftsService.GetSnapshotWorker().Start(ctx)
	}
	if giftsService.GetIngestionEngine() != nil {
		go giftsService.GetIngestionEngine().Start(ctx)
	}
	giftsHandler := handler.NewGiftsHandler(giftsService)

	// Initialize Intel Credits System
	intelCreditService := intelcredit.NewIntelCreditService(db)
	intelCreditHandler := handler.NewIntelCreditHandler(intelCreditService, cache)

	// Initialize Visual Asset Card Generator and inject into handlers for DM & Bot delivery
	cardGen := cardgen.NewCardGenerator()
	cardgen.StartSharesCleanupJob(ctx, 24*time.Hour, 7*24*time.Hour)

	var mainTgClient *telegram.BotAPIClient
	if botToken != "" {
		mainTgClient = telegram.NewBotAPIClient(botToken)
		handler.ValidateCustomEmojis(ctx, mainTgClient)
	}

	numbersHandler.SetCardGenerator(cardGen)
	if mainTgClient != nil {
		numbersHandler.SetTelegramClient(mainTgClient)
	}

	giftsHandler.SetCardGenerator(cardGen)
	if mainTgClient != nil {
		giftsHandler.SetTelegramClient(mainTgClient)
	}

	intelCreditHandler.SetCardGenerator(cardGen)
	if mainTgClient != nil {
		intelCreditHandler.SetTelegramClient(mainTgClient)
	}
	intelCreditHandler.SetAVMService(avmService)
	if cryptoPriceService != nil {
		intelCreditHandler.SetCryptoPriceService(cryptoPriceService)
	}

	if webhookHandler != nil {
		webhookHandler.SetCardGenerator(cardGen)
		webhookHandler.SetNumbersService(numbersService)
		webhookHandler.SetAVMService(avmService)
		webhookHandler.SetCryptoPriceService(cryptoPriceService)
		webhookHandler.SetIntelCreditService(intelCreditService)
		webhookHandler.SetProfileService(profileService)
		webhookHandler.SetSettingsRepo(settingsRepo)
		webhookHandler.SetOwnerRepo(ownerRepo)
	}

	// Initialize Group Leaderboard & Boost Tracker
	groupLeaderboardRepo := repository.NewGroupLeaderboardRepo(db)
	groupLeaderboardService := service.NewGroupLeaderboardService(groupLeaderboardRepo, intelCreditService, cache)
	if mainTgClient != nil {
		groupLeaderboardService.SetTelegramClient(mainTgClient)
	}
	groupLeaderboardHandler := handler.NewGroupLeaderboardHandler(groupLeaderboardService)

	if webhookHandler != nil {
		webhookHandler.SetGroupLeaderboardService(groupLeaderboardService)
	}

	// Start Hourly Boost Sync & 24h Reward Worker
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()

		select {
		case <-time.After(30 * time.Second):
			_ = groupLeaderboardService.RunHourlyBoostSyncAndRewards(ctx, mainTgClient, "@FragmentInvestors")
		case <-ctx.Done():
			return
		}

		for {
			select {
			case <-ticker.C:
				_ = groupLeaderboardService.RunHourlyBoostSyncAndRewards(ctx, mainTgClient, "@FragmentInvestors")
			case <-ctx.Done():
				return
			}
		}
	}()

	investorsHandler := handler.NewInvestorsPublicHandler(settingsRepo)

	// Register API and Owner routes via modular router package
	router.RegisterAPIRoutes(r, router.Config{
		DB:                      db,
		Cache:                   cache,
		OwnerRepo:               ownerRepo,
		SettingsRepo:            settingsRepo,
		AuthHandler:             authHandler,
		UsernameHandler:         usernameHandler,
		CollectionHandler:       collectionHandler,
		ProfileHandler:          profileHandler,
		WebhookHandler:          webhookHandler,
		OwnerHandler:            ownerHandler,
		NumbersHandler:          numbersHandler,
		GiftsHandler:            giftsHandler,
		IntelCreditHandler:      intelCreditHandler,
		InvestorsHandler:        investorsHandler,
		GroupLeaderboardHandler: groupLeaderboardHandler,
	})

	// Start server with graceful shutdown
	port := cfg.App.Port
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

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("Shutting down server...")

	cancelMain()

	ctxShut, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctxShut); err != nil {
		slog.Error("Server forced to shutdown", "error", err)
		os.Exit(1)
	}

	slog.Info("Server exiting")
}

func AutoRegisterMainBot(ctx context.Context, db *repository.Database, botRepo *repository.BotRepo) {
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

	var dbID string
	var secretToken string
	err = db.Pool.QueryRow(ctx, "SELECT id, webhook_secret_token FROM managed_bots WHERE bot_id = $1", botID).Scan(&dbID, &secretToken)

	var botUUID uuid.UUID
	if err != nil {
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

		slog.Info("AutoRegisterMainBot: main bot not found in DB, registering...", "bot_id", botID)
		tgClient := telegram.NewBotAPIClient(token)
		me, err := tgClient.GetMe(ctx)
		if err != nil {
			slog.Error("AutoRegisterMainBot: failed to verify bot token with Telegram", "error", err)
			return
		}

		_, err = db.Pool.Exec(ctx, "UPDATE managed_bots SET bot_username = bot_username || '_conflict_' || bot_id WHERE LOWER(bot_username) = LOWER($1) AND bot_id != $2", me.Username, botID)
		if err != nil {
			slog.Warn("AutoRegisterMainBot: failed to rename conflicting bot_username", "error", err)
		}

		encrypted, encErr := crypto.EncryptToken(token)
		if encErr != nil {
			slog.Error("AutoRegisterMainBot: failed to encrypt bot token", "error", encErr)
			return
		}

		secretBytes := make([]byte, 32)
		if _, randErr := cryptoRand.Read(secretBytes); randErr != nil {
			slog.Error("AutoRegisterMainBot: failed to generate secret bytes", "error", randErr)
			return
		}
		secretHex := hex.EncodeToString(secretBytes)

		actualName := me.FirstName
		if actualName == "" {
			actualName = "iFragmentBot"
		}

		bot := &repository.ManagedBot{
			OwnerUserID:        ownerID,
			BotTokenEncrypted:  encrypted,
			BotUsername:        me.Username,
			BotName:            actualName,
			BotID:              me.ID,
			Status:             "active",
			WebhookSecretToken: secretHex,
		}

		if err := botRepo.CreateBot(ctx, bot); err != nil {
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
			"my_chat_member",
			"chat_member",
			"chat_join_request",
			"pre_checkout_query",
			"inline_query",
			"chosen_inline_result",
			"guest_message",
			"chat_boost",
			"removed_chat_boost",
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

// StartWebhookGuardian periodically verifies that the Telegram Bot webhook still points
// to this server's expected URL and automatically re-registers it if another instance
// or external process overwrote it.
func StartWebhookGuardian(ctx context.Context, db *repository.Database, botRepo *repository.BotRepo) {
	if db == nil || db.Pool == nil {
		return
	}
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	if token == "" {
		token = os.Getenv("BOT_TOKEN")
	}
	if token == "" {
		return
	}

	backendURL := os.Getenv("BACKEND_URL")
	if backendURL == "" {
		backendURL = os.Getenv("API_URL")
	}
	if backendURL == "" {
		backendURL = os.Getenv("APP_URL")
	}
	if backendURL == "" {
		return
	}
	expectedPrefix := strings.TrimSuffix(backendURL, "/") + "/api/v1/webhook/telegram/"

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	client := &http.Client{Timeout: 10 * time.Second}
	infoURL := fmt.Sprintf("https://api.telegram.org/bot%s/getWebhookInfo", token)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			req, err := http.NewRequestWithContext(ctx, "GET", infoURL, nil)
			if err != nil {
				continue
			}
			resp, err := client.Do(req)
			if err != nil {
				continue
			}
			var info struct {
				Ok     bool `json:"ok"`
				Result struct {
					URL string `json:"url"`
				} `json:"result"`
			}
			_ = json.NewDecoder(resp.Body).Decode(&info)
			resp.Body.Close()

			if info.Ok && !strings.HasPrefix(info.Result.URL, expectedPrefix) {
				slog.Warn("WebhookGuardian: detected webhook drift, re-registering main bot webhook",
					"current_url", info.Result.URL,
					"expected_prefix", expectedPrefix,
				)
				AutoRegisterMainBot(ctx, db, botRepo)
			}
		}
	}
}

func isLegacyRenderEnv() bool {
	if os.Getenv("RENDER") != "" || os.Getenv("RENDER_SERVICE_ID") != "" || os.Getenv("RENDER_EXTERNAL_URL") != "" {
		return true
	}
	for _, key := range []string{"APP_URL", "BACKEND_URL", "API_URL"} {
		if strings.Contains(strings.ToLower(os.Getenv(key)), "onrender.com") {
			return true
		}
	}
	return false
}

func runDormantRenderStandby() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	slog.Warn("Legacy Render.com environment detected — starting in DORMANT STANDBY mode (GramBroadcaster and Webhook registration disabled)", "port", port)

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok","mode":"dormant-standby","message":"Primary server is hosted on VPS"}`))
	})

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	ctxShut, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctxShut)
}
