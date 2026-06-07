package main

import (
	"context"
	"bytes"
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

	"ifragment-backend/internal/client/fragment"

	"ifragment-backend/internal/client/marketapp"
	"ifragment-backend/internal/client/mtproto"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/handler"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/logger"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service"
	"ifragment-backend/internal/service/botmgmt"
	"ifragment-backend/internal/service/channelmgmt"
	"ifragment-backend/internal/service/payment"
	"ifragment-backend/internal/service/username"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
	"strings"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
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
		requiredSecrets := []string{"WEBHOOK_SECRET_TOKEN", "BOT_TOKEN", "DATABASE_URL"}
		for _, s := range requiredSecrets {
			if os.Getenv(s) == "" {
				slog.Error("FATAL: Required secret is missing in production", "secret", s)
				os.Exit(1)
			}
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
		slog.Warn("Database connection failed, continuing without DB", "error", err)
	} else {
		defer db.Close()

		// Run Migrations with retry
		for i := 0; i < 5; i++ {
			m, mErr := migrate.New("file://migrations", os.Getenv("DATABASE_URL"))
			if mErr == nil {
				if upErr := m.Up(); upErr != nil && upErr != migrate.ErrNoChange {
					slog.Warn("Database migration warning", "error", upErr)
				} else {
					slog.Info("Database migrations applied successfully")
				}
				break
			}
			slog.Info("Waiting for database to be ready for migrations...", "attempt", i+1)
			time.Sleep(2 * time.Second)
		}
	}

	// Initialize Cache
	cache, err := repository.NewCache(ctx)
	if err != nil {
		slog.Warn("Cache connection failed, continuing without Cache", "error", err)
	} else {
		defer cache.Close()
	}

	// Initialize Router
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

	allowedOrigins := strings.Split(os.Getenv("ALLOWED_ORIGINS"), ",")
	if len(allowedOrigins) == 1 && allowedOrigins[0] == "" {
		allowedOrigins = []string{"http://localhost:5173", "http://127.0.0.1:5173"} // fallback for dev
	}
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

	fragClient := fragment.NewClient()
	mtprotoClient, err := mtproto.InitClient(ctx)
	if err != nil {
		slog.Error("FATAL: Failed to initialize MTProto client", "error", err)
		os.Exit(1)
	}
	marketappClient := marketapp.NewClient()

	// Initialize Services
	aggregatorService := username.NewAggregatorService(tonClient, marketappClient, cache)
	paymentService := payment.NewStarsService(db)
	reportService := username.NewReportService(ctx, db, cache, tonClient, fragClient, marketappClient, mtprotoClient)

	// Initialize Bot Management repos & services
	botRepo := repository.NewBotRepo(db)
	settingsRepo := repository.NewSettingsRepo(db, cache)
	auditRepo := repository.NewAuditRepo(db)
	frgRepo := repository.NewFRGRepo(db)
	analyticsRepo := repository.NewAnalyticsRepo(db)

	botService := botmgmt.NewBotService(botRepo, settingsRepo, auditRepo, frgRepo, analyticsRepo)
	AutoRegisterMainBot(ctx, db, botService)
	marketplaceService := botmgmt.NewMarketplaceService(frgRepo, nil)
	moderatorService := botmgmt.NewModeratorService(settingsRepo, botRepo, auditRepo, analyticsRepo, cache)

	// 🚀 Start Background Expiration Worker
	botService.StartBackgroundTasks(ctx)

	// 🚀 Start Background Partition & Maintenance Worker
	if db != nil {
		partitionWorker := username.NewPartitionWorker(db)
		go partitionWorker.Start(ctx)
	}

	// Initialize Handlers
	channelRepo := repository.NewChannelRepo(db, cache)
	channelService := channelmgmt.NewChannelService(channelRepo, botRepo, auditRepo)
	
	// 🚀 Start Channel Background Workers (Post scheduler & daily analytics snapshots)
	channelService.StartBackgroundTasks(ctx)

	channelHandler := handler.NewChannelHandler(channelService)

	usernameHandler := handler.NewUsernameHandler(aggregatorService, reportService, fragClient, mtprotoClient, cache)
	premiumHandler := handler.NewPremiumHandler(reportService, paymentService)
	webhookHandler := handler.NewWebhookHandler(db, moderatorService, botRepo, channelService)
	botMgmtHandler := handler.NewBotMgmtHandler(botService, marketplaceService)
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
	profileHandler := handler.NewProfileHandler(profileService, paymentService)
	gamificationService := service.NewGamificationService(db, cache)
	gamificationHandler := handler.NewGamificationHandler(gamificationService)
	clanService := service.NewClanService(db, cache)
	clanHandler := handler.NewClanHandler(clanService)

	authHandler := handler.NewAuthHandler(db)

	// Initialize Owner components
	ownerRepo := repository.NewOwnerRepo(db)
	middleware.InitAuthMiddleware(ownerRepo)
	ownerService := service.NewOwnerService(ownerRepo, frgRepo, cache)
	ownerHandler := handler.NewOwnerHandler(ownerService)

	// Public Routes
	r.Route("/api/v1", func(r chi.Router) {
		// Health check routes kept outside ban checking to avoid database liveness probe DoS
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"status": "ok"}`))
		})

		r.Get("/healthz/live", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"status": "alive"}`))
		})

		r.Get("/healthz/ready", func(w http.ResponseWriter, r *http.Request) {
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

		r.Get("/diagnostics/telegram", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			tgClient := &http.Client{Timeout: 5 * time.Second}
			tgResp, err := tgClient.Get("https://api.telegram.org")
			if err != nil {
				// P1-S5: Do not leak internal error details to client
				slog.Error("Telegram API health check failed", "error", err)
				w.WriteHeader(http.StatusServiceUnavailable)
				w.Write([]byte(`{"status": "unhealthy", "telegram_api": "unreachable"}`))
				return
			}
			tgResp.Body.Close()
			w.Write([]byte(`{"status": "healthy", "telegram_api": "reachable"}`))
		})

		// Protected core business API routes (require ban checking and blocking impersonated writes)
		r.Group(func(r chi.Router) {
			r.Use(middleware.BlockImpersonatedWrites)
			r.Use(middleware.UserBanCheckMiddleware(ownerRepo))

			r.Get("/config", profileHandler.GetPublicConfig)

			r.Post("/webhook/telegram/{botID}", webhookHandler.HandleTelegramWebhook)
			r.Post("/webhook/tonapi", webhookHandler.HandleTonAPIWebhook)
			r.With(middleware.ValidateTelegramInitData(db, cache)).Post("/auth/token", authHandler.IssueToken)

		r.Route("/usernames", func(r chi.Router) {
			r.Get("/collection/stats", usernameHandler.GetCollectionStats)
			r.Get("/check", usernameHandler.CheckAvailability)
			r.Get("/quick", usernameHandler.QuickAnalysis)
			r.Get("/quick/stream", usernameHandler.StreamQuickAnalysis)
			r.Get("/trending", usernameHandler.GetTrending)
			r.Get("/rates", usernameHandler.GetRates)
			r.Get("/similar", usernameHandler.GetSimilar)

			// Protected Routes (Require JWT)
			r.Group(func(r chi.Router) {
				r.Use(middleware.AuthMiddleware)
				r.Post("/report/request", premiumHandler.RequestPremiumReport)
				r.Get("/report/view", premiumHandler.GetReport)
				r.Get("/report/history", premiumHandler.GetHistory)
			})
		})

		// ─── Bot Management API ─────────────────────────
		r.Route("/bots", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)

			r.Get("/", botMgmtHandler.ListBots)
			r.Post("/", botMgmtHandler.RegisterBot)
			r.Get("/{botID}", botMgmtHandler.GetBot)
			r.Delete("/{botID}", botMgmtHandler.RevokeBot)
			r.Get("/{botID}/groups", botMgmtHandler.ListGroups)
		})

		r.Route("/groups", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)

			r.Get("/{groupID}", botMgmtHandler.GetGroup)
			r.Get("/{groupID}/settings", botMgmtHandler.GetSettings)
			r.Put("/{groupID}/settings", botMgmtHandler.UpdateSettings)
			r.Get("/{groupID}/analytics", botMgmtHandler.GetAnalytics)
			r.Get("/{groupID}/audit", botMgmtHandler.GetAuditLogs)
		})

		r.Route("/channels", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)
			r.Use(middleware.NewChannelRateLimiter(cache))

			r.Get("/", channelHandler.ListChannels)
			r.Post("/connect", channelHandler.ConnectChannel)
			r.Get("/{channelID}", channelHandler.GetChannel)
			r.Delete("/{channelID}", channelHandler.DisconnectChannel)
			r.Get("/{channelID}/settings", channelHandler.GetSettings)
			r.Put("/{channelID}/settings", channelHandler.UpdateSettings)
			r.Get("/{channelID}/audit", channelHandler.GetAuditLogs)
			r.Get("/{channelID}/analytics", channelHandler.GetAnalytics)
			r.Post("/{channelID}/posts", channelHandler.CreatePost)

			// Forwarding Rules
			r.Get("/{channelID}/forwarding/rules", channelHandler.GetForwardingRules)
			r.Post("/{channelID}/forwarding/rules", channelHandler.CreateForwardingRule)
			r.Put("/{channelID}/forwarding/rules/{ruleID}", channelHandler.UpdateForwardingRule)
			r.Delete("/{channelID}/forwarding/rules/{ruleID}", channelHandler.DeleteForwardingRule)

			// Sync Admins
			r.Post("/{channelID}/admins/sync", channelHandler.SyncAdmins)
			r.Get("/{channelID}/admins", channelHandler.GetAdmins)

			// Custom Inline Buttons
			r.Get("/{channelID}/buttons", channelHandler.GetButtons)
			r.Post("/{channelID}/buttons", channelHandler.SaveButtons)
		})

		r.Route("/subscription", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)

			r.Get("/packages", botMgmtHandler.GetPackages)
			r.Post("/subscribe", botMgmtHandler.Subscribe)
		})

		r.Route("/frg", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)

			r.Get("/balance", botMgmtHandler.GetFRGBalance)
			r.Get("/transactions", botMgmtHandler.GetFRGTransactions)
		})

		r.Route("/marketplace", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)

			r.Get("/options", botMgmtHandler.GetPurchaseOptions)
			r.Post("/purchase/stars", botMgmtHandler.PurchaseWithStars)
			r.Post("/purchase/stars/invoice", botMgmtHandler.CreateStarsInvoice)
			r.Post("/purchase/toncoin", botMgmtHandler.PurchaseWithToncoin)
			r.Post("/convert/airdrop", botMgmtHandler.ConvertAirdropCoins)
		})

		r.Route("/profile", func(r chi.Router) {
			r.Get("/avatar/{userID}", profileHandler.GetAvatar)

			r.Group(func(r chi.Router) {
				r.Use(middleware.AuthMiddleware)

				r.Delete("/gdpr", profileHandler.DeleteUserDataGDPR)
				r.Get("/stats", profileHandler.GetStats)
				r.Get("/achievements", profileHandler.GetAchievements)
				r.Get("/achievements/defs", profileHandler.GetAchievementDefs)
				r.Get("/referral", profileHandler.GetReferralData)
				r.Post("/referral", profileHandler.SetReferrerCode)
				r.Post("/tap", profileHandler.AddTaps)

				// Cosmetics & Premium routes
				r.Get("/cosmetics", profileHandler.GetCosmetics)
				r.Post("/cosmetics/purchase", profileHandler.PurchaseCosmetic)
				r.Post("/cosmetics/equip", profileHandler.EquipCosmetic)
				r.Post("/emoji-status", profileHandler.SetEmojiStatus)
				r.Post("/premium/checkout", profileHandler.CreatePremiumCheckout)

				// Gamification routes
				r.Get("/daily", gamificationHandler.GetDailyStatus)
				r.Post("/daily/claim", gamificationHandler.ClaimDailyReward)
				r.Get("/tasks", gamificationHandler.GetTasksStatus)
				r.Post("/tasks/complete", gamificationHandler.CompleteTask)
				r.Get("/boosts", gamificationHandler.GetBoostsStatus)
				r.Post("/boosts/upgrade", gamificationHandler.UpgradeBoost)
				r.Get("/leaderboard", gamificationHandler.GetLeaderboard)

				// Clan routes
				r.Get("/clan", clanHandler.GetClanDetails)
				r.Post("/clan/join", clanHandler.JoinClan)
				r.Post("/clan/leave", clanHandler.LeaveClan)
				r.Get("/clan/top", clanHandler.GetTopClans)
				r.Get("/clans/top", clanHandler.GetTopClans)

				// Promo Code redemption
				r.Post("/promo/redeem", ownerHandler.RedeemPromo)
			})
		})

		}) // Close protected /api/v1 routes group

		// ─── Owner Panel APIs ───────────────────────────
		r.Route("/owner", func(r chi.Router) {
			r.Post("/auth/totp", ownerHandler.Login)

			r.Group(func(r chi.Router) {
				r.Use(middleware.AuthMiddleware)
				r.Use(middleware.ValidateOwnerAdmin)

				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/dashboard/stats", ownerHandler.GetStats)
				r.With(middleware.RequirePermission(middleware.PermSearchUsers)).Get("/users/search", ownerHandler.SearchUsers)
				r.With(middleware.RequirePermission(middleware.PermAdjustFRG)).Post("/users/adjust-frg", ownerHandler.AdjustFrg)
				r.With(middleware.RequirePermission(middleware.PermImpersonate)).Post("/users/impersonate", ownerHandler.Impersonate)
				r.With(middleware.RequirePermission(middleware.PermBanUser)).Post("/users/ban", ownerHandler.BanUser)
				r.With(middleware.RequirePermission(middleware.PermBanUser)).Post("/users/unban", ownerHandler.UnbanUser)
				r.With(middleware.RequirePermission(middleware.PermAuditView)).Get("/audit-logs", ownerHandler.GetAuditLogs)

				// Promo Code management
				r.With(middleware.RequirePermission(middleware.PermPromoManage)).Post("/promos", ownerHandler.CreatePromo)
				r.With(middleware.RequirePermission(middleware.PermPromoManage)).Delete("/promos", ownerHandler.DeletePromo)
				r.With(middleware.RequirePermission(middleware.PermPromoView)).Get("/promos", ownerHandler.ListPromos)

				// Dynamic Quest management
				r.With(middleware.RequirePermission(middleware.PermQuestManage)).Get("/quests", ownerHandler.ListQuests)
				r.With(middleware.RequirePermission(middleware.PermQuestManage)).Post("/quests", ownerHandler.CreateQuest)
				r.With(middleware.RequirePermission(middleware.PermQuestManage)).Put("/quests", ownerHandler.UpdateQuest)
				r.With(middleware.RequirePermission(middleware.PermQuestManage)).Delete("/quests", ownerHandler.DeleteQuest)
			})
		})
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
		slog.Warn("AutoRegisterMainBot: APP_URL is not set, skipping webhook registration")
		return
	}

	ownerIDStr := os.Getenv("OWNER_TELEGRAM_ID")
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
			Username:     "owner",
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
	webhookURL := fmt.Sprintf("%s/api/v1/webhook/telegram/%s", strings.TrimSuffix(appURL, "/"), botUUID.String())
	slog.Info("AutoRegisterMainBot: setting webhook URL", "url", webhookURL)

	tgWebhookURL := fmt.Sprintf("https://api.telegram.org/bot%s/setWebhook", token)
	payload := map[string]interface{}{
		"url":          webhookURL,
		"secret_token": secretToken,
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
