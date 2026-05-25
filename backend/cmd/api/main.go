package main

import (
	"context"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/getsentry/sentry-go"
	sentryhttp "github.com/getsentry/sentry-go/http"
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"ifragment-backend/internal/client/fragment"

	"ifragment-backend/internal/client/marketapp"
	"ifragment-backend/internal/client/mtproto"
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
			logger := slog.With("request_id", reqID, "path", r.URL.Path)
			ctx = context.WithValue(ctx, "logger", logger)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	})
	r.Use(chiMiddleware.Logger)

	// Sentry Initialization
	sentry.Init(sentry.ClientOptions{
		Dsn:              os.Getenv("SENTRY_DSN"),
		TracesSampleRate: 0.1,
		Environment:      os.Getenv("APP_ENV"),
	})
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

	r.Use(middleware.NewRateLimiter(cache))
	r.Use(sentryhttp.New(sentryhttp.Options{Repanic: true}).Handle)
	r.Use(middleware.CSRF)

	// Prometheus Metrics
	r.Handle("/metrics", promhttp.Handler())

	// Initialize Clients
	tonClient := tonapi.NewClient()

	fragClient := fragment.NewClient()
	mtprotoClient := mtproto.InitClient(ctx)
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
	marketplaceService := botmgmt.NewMarketplaceService(frgRepo)
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
	profileHandler := handler.NewProfileHandler(profileService, paymentService)
	gamificationService := service.NewGamificationService(db, cache)
	gamificationHandler := handler.NewGamificationHandler(gamificationService)
	clanService := service.NewClanService(db)
	clanHandler := handler.NewClanHandler(clanService)

	authHandler := handler.NewAuthHandler()

	// Public Routes
	r.Route("/api/v1", func(r chi.Router) {
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
				w.WriteHeader(http.StatusServiceUnavailable)
				w.Write([]byte(fmt.Sprintf(`{"status": "unhealthy", "error": %q}`, err.Error())))
				return
			}
			tgResp.Body.Close()
			w.Write([]byte(`{"status": "healthy", "telegram_api": "reachable"}`))
		})

		r.Get("/config", profileHandler.GetPublicConfig)

		r.Post("/webhook/telegram/{botID}", webhookHandler.HandleTelegramWebhook)
		r.Post("/webhook/tonapi", webhookHandler.HandleTonAPIWebhook)
		r.With(middleware.ValidateTelegramInitData(cache)).Post("/auth/token", authHandler.IssueToken)

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
			r.Post("/purchase/toncoin", botMgmtHandler.PurchaseWithToncoin)
			r.Post("/convert/airdrop", botMgmtHandler.ConvertAirdropCoins)
		})

		r.Route("/profile", func(r chi.Router) {
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
