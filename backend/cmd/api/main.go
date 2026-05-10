package main

import (
	"context"
	"log"
	"net/http"
	"os"

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
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	ctx := context.Background()

	// Initialize Database
	db, err := repository.NewDatabase(ctx)
	if err != nil {
		log.Printf("⚠️ Database connection failed: %v. Continuing without DB.", err)
	} else {
		defer db.Close()
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

	// Base middleware
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(middleware.NewRateLimiter())

	// CORS (Patch 1)
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"*"}, // In prod, specify the TWA URL
		AllowedMethods:   []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Telegram-Init-Data"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	})
	r.Use(c.Handler)

	// Initialize Clients
	tonClient := tonapi.NewClient()

	fragClient := fragment.NewClient()
	mtprotoClient := mtproto.InitClient()
	marketappClient := marketapp.NewClient()

	// Initialize Services
	aggregatorService := username.NewAggregatorService(tonClient, marketappClient)
	paymentService := payment.NewStarsService(db)
	reportService := username.NewReportService(db, cache, tonClient, fragClient, marketappClient, mtprotoClient)

	// Initialize Handlers
	usernameHandler := handler.NewUsernameHandler(aggregatorService, reportService, fragClient, mtprotoClient, cache)
	premiumHandler := handler.NewPremiumHandler(reportService, paymentService)
	webhookHandler := handler.NewWebhookHandler(db)

	// Public Routes
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"status": "ok"}`))
		})

		r.Post("/webhook/telegram", webhookHandler.HandleTelegramWebhook)

		r.Route("/usernames", func(r chi.Router) {
			r.Get("/collection/stats", usernameHandler.GetCollectionStats)
			r.Get("/check", usernameHandler.CheckAvailability)
			r.Get("/quick", usernameHandler.QuickAnalysis)
			
			// Protected Routes (Require Telegram InitData)
			r.Group(func(r chi.Router) {
				r.Use(middleware.ValidateTelegramInitData)
				r.Post("/report/request", premiumHandler.RequestPremiumReport)
				r.Get("/report/view", premiumHandler.GetReport)
				r.Get("/report/history", premiumHandler.GetHistory)
			})
		})
	})

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("🚀 iFragment Backend starting on port %s...", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
