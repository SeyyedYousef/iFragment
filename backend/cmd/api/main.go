package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/google/uuid"
	"github.com/getsentry/sentry-go"
	sentryhttp "github.com/getsentry/sentry-go/http"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"ifragment-backend/internal/client/fragment"

	"ifragment-backend/internal/client/tonapi"
	"ifragment-backend/internal/client/marketapp"
	"ifragment-backend/internal/client/mtproto"
	"ifragment-backend/internal/handler"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/repository"
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
)

func main() {
	// Load .env file (only in non-production)
	if os.Getenv("APP_ENV") != "production" {
		if err := godotenv.Load(); err != nil {
			log.Println("No .env file found, using system environment variables")
		}
	}

	ctx := context.Background()

	// Initialize Database
	db, err := repository.NewDatabase(ctx)
	if err != nil {
		log.Printf("⚠️ Database connection failed: %v. Continuing without DB.", err)
	} else {
		defer db.Close()

		// Run Migrations with retry
		for i := 0; i < 5; i++ {
			m, mErr := migrate.New("file://migrations", os.Getenv("DATABASE_URL"))
			if mErr == nil {
				if upErr := m.Up(); upErr != nil && upErr != migrate.ErrNoChange {
					log.Printf("⚠️ Database migration warning: %v", upErr)
				} else {
					log.Println("✅ Database migrations applied successfully")
				}
				break
			}
			log.Printf("⏳ Waiting for database to be ready for migrations... (%d/5)", i+1)
			time.Sleep(2 * time.Second)
		}
	}

	// Initialize Cache
	cache, err := repository.NewCache(ctx)
	if err != nil {
		log.Printf("⚠️ Cache connection failed: %v. Continuing without Cache.", err)
	} else {
		defer cache.Close()
	}

	// Initialize Router
	r := chi.NewRouter()

	r.Use(middleware.SecurityHeaders)
	// Request-ID and Structured Logging
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			reqID := r.Header.Get("X-Request-ID")
			if reqID == "" {
				reqID = uuid.NewString()
			}
			w.Header().Set("X-Request-ID", reqID)
			ctx := context.WithValue(r.Context(), "request_id", reqID)
			logger := slog.With("request_id", reqID, "path", r.URL.Path)
			ctx = context.WithValue(ctx, "logger", logger)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	})
	r.Use(chiMiddleware.RealIP)
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(middleware.NewRateLimiter())

	// Sentry
	sentry.Init(sentry.ClientOptions{
		Dsn:              os.Getenv("SENTRY_DSN"),
		TracesSampleRate: 0.1,
		Environment:      os.Getenv("APP_ENV"),
	})
	defer sentry.Flush(2 * time.Second)
	r.Use(sentryhttp.New(sentryhttp.Options{Repanic: true}).Handle)

	// Prometheus Metrics
	r.Handle("/metrics", promhttp.Handler())

	allowedOrigins := strings.Split(os.Getenv("ALLOWED_ORIGINS"), ",")
	if len(allowedOrigins) == 1 && allowedOrigins[0] == "" {
		allowedOrigins = []string{"http://localhost:5173", "http://127.0.0.1:5173"} // fallback for dev
	}
	c := cors.New(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Telegram-Init-Data", "X-Request-ID"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           86400,
	})
	r.Use(c.Handler)

	// Initialize Clients
	tonClient := tonapi.NewClient()

	fragClient := fragment.NewClient()
	mtprotoClient := mtproto.InitClient(ctx)
	marketappClient := marketapp.NewClient()

	// Initialize Services
	aggregatorService := username.NewAggregatorService(tonClient, marketappClient)
	paymentService := payment.NewStarsService(db)
	reportService := username.NewReportService(db, cache, tonClient, fragClient, marketappClient, mtprotoClient)

	// Initialize Handlers
	usernameHandler := handler.NewUsernameHandler(aggregatorService, reportService, fragClient, mtprotoClient, cache)
	premiumHandler := handler.NewPremiumHandler(reportService, paymentService)
	webhookHandler := handler.NewWebhookHandler(db)

	authHandler := handler.NewAuthHandler()

	// Public Routes
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"status": "ok"}`))
		})

		r.Post("/webhook/telegram", webhookHandler.HandleTelegramWebhook)
		r.With(middleware.ValidateTelegramInitData).Post("/auth/token", authHandler.IssueToken)

		r.Route("/usernames", func(r chi.Router) {
			r.Get("/collection/stats", usernameHandler.GetCollectionStats)
			r.Get("/check", usernameHandler.CheckAvailability)
			r.Get("/quick", usernameHandler.QuickAnalysis)
			
			// Protected Routes (Require JWT)
			r.Group(func(r chi.Router) {
				r.Use(middleware.AuthMiddleware)
				r.Post("/report/request", premiumHandler.RequestPremiumReport)
				r.Get("/report/view", premiumHandler.GetReport)
				r.Get("/report/history", premiumHandler.GetHistory)
			})
		})
	})

	// Start server with graceful shutdown
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	
	srv := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	go func() {
		log.Printf("🚀 iFragment Backend starting on port %s...", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctxShut, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctxShut); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exiting")
}
