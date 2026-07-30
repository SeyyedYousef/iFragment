package router

import (
	"ifragment-backend/internal/handler"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/repository"

	"github.com/go-chi/chi/v5"
)

type Config struct {
	DB                    *repository.Database
	Cache                 *repository.Cache
	BotMgmtHandler        *handler.BotMgmtHandler
	WebhookHandler        *handler.WebhookHandler
	OwnerHandler          *handler.OwnerHandler
	UsernameHandler       *handler.UsernameHandler
	UsernamePublicHandler *handler.UsernamePublicHandler
	ProfileHandler        *handler.ProfileHandler
	GamificationHandler   *handler.GamificationHandler
	ClanHandler           *handler.ClanHandler
	ChannelMgmtHandler    *handler.ChannelMgmtHandler
}

// RegisterAPIRoutes mounts API v1 sub-routes onto the router
func RegisterAPIRoutes(r chi.Router, cfg Config) {
	r.Route("/api/v1", func(r chi.Router) {
		// Public Webhook Routes
		r.Post("/webhook/telegram/{botUUID}", cfg.WebhookHandler.HandleWebhook)

		// Telegram Mini App authentication middleware
		tgAuth := middleware.ValidateTelegramInitData(cfg.DB, cfg.Cache)

		// Public Username / AVM valuation endpoints
		r.Route("/username", func(r chi.Router) {
			r.Get("/valuation", cfg.UsernamePublicHandler.GetValuation)
			r.Get("/search", cfg.UsernamePublicHandler.SearchUsernames)
			r.Get("/market", cfg.UsernamePublicHandler.GetMarketListings)

			// Authenticated user endpoints
			r.Group(func(r chi.Router) {
				r.Use(tgAuth)
				r.Post("/appraisal", cfg.UsernameHandler.RequestAppraisal)
			})
		})

		// Protected Mini App Routes
		r.Group(func(r chi.Router) {
			r.Use(tgAuth)
			r.Use(middleware.UserBanCheckMiddleware(cfg.DB))

			// Bot & Group Management
			r.Route("/bots", func(r chi.Router) {
				r.Get("/", cfg.BotMgmtHandler.ListBots)
				r.Post("/", cfg.BotMgmtHandler.RegisterBot)
				r.Get("/{botID}", cfg.BotMgmtHandler.GetBot)
				r.Delete("/{botID}", cfg.BotMgmtHandler.DeleteBot)
				r.Get("/{botID}/analytics", cfg.BotMgmtHandler.GetAnalytics)
				r.Get("/{botID}/groups", cfg.BotMgmtHandler.ListGroups)

				// Group settings & subscriptions
				r.Get("/groups/{groupID}/settings", cfg.BotMgmtHandler.GetSettings)
				r.Put("/groups/{groupID}/settings", cfg.BotMgmtHandler.UpdateSettings)
				r.Get("/packages", cfg.BotMgmtHandler.GetPackages)
				r.Post("/subscribe", cfg.BotMgmtHandler.Subscribe)
				r.Post("/subscribe/airdrop", cfg.BotMgmtHandler.SubscribeWithAirdrop)
				r.Post("/subscribe/stars", cfg.BotMgmtHandler.SubscribeStarsInvoice)
			})

			// Channel Management
			r.Route("/channels", func(r chi.Router) {
				r.Get("/", cfg.ChannelMgmtHandler.ListChannels)
				r.Post("/", cfg.ChannelMgmtHandler.RegisterChannel)
				r.Get("/{channelID}", cfg.ChannelMgmtHandler.GetChannel)
				r.Delete("/{channelID}", cfg.ChannelMgmtHandler.DeleteChannel)
				r.Get("/{channelID}/settings", cfg.ChannelMgmtHandler.GetSettings)
				r.Put("/{channelID}/settings", cfg.ChannelMgmtHandler.UpdateSettings)
				r.Post("/subscribe", cfg.BotMgmtHandler.SubscribeChannel)
				r.Post("/subscribe/airdrop", cfg.BotMgmtHandler.SubscribeChannelWithAirdrop)
			})

			// Profile & User
			r.Route("/profile", func(r chi.Router) {
				r.Get("/", cfg.ProfileHandler.GetProfile)
				r.Put("/wallet", cfg.ProfileHandler.UpdateWallet)
				r.Get("/stats", cfg.ProfileHandler.GetStats)

				// Gamification Tap Game
				r.Post("/taps", cfg.GamificationHandler.ProcessTaps)
				r.Get("/daily", cfg.GamificationHandler.GetDailyStatus)
				r.Post("/daily/claim", cfg.GamificationHandler.ClaimDailyReward)
				r.Get("/tasks", cfg.GamificationHandler.GetTasksStatus)
				r.Post("/tasks/complete", cfg.GamificationHandler.CompleteTask)
				r.Get("/boosts", cfg.GamificationHandler.GetBoostsStatus)
				r.Post("/boosts/upgrade", cfg.GamificationHandler.UpgradeBoost)
				r.Post("/boosts/daily/turbo", cfg.GamificationHandler.ApplyTurbo)
				r.Post("/boosts/daily/full-energy", cfg.GamificationHandler.ApplyFullEnergy)
				r.Post("/mining/collect", cfg.GamificationHandler.CollectOfflineMining)
				r.Post("/mining/start", cfg.GamificationHandler.StartOfflineMining)
				r.Get("/leaderboard", cfg.GamificationHandler.GetLeaderboard)
				r.Get("/daily-combo", cfg.GamificationHandler.GetDailyComboStatus)
				r.Post("/daily-combo/claim", cfg.GamificationHandler.ClaimDailyCombo)

				// Clan routes
				r.Get("/clan", cfg.ClanHandler.GetClanDetails)
				r.Post("/clan/join", cfg.ClanHandler.JoinClan)
				r.Post("/clan/leave", cfg.ClanHandler.LeaveClan)
				r.Get("/clan/top", cfg.ClanHandler.GetTopClans)
				r.Get("/clans/top", cfg.ClanHandler.GetTopClans)
				r.Get("/clan/members", cfg.ClanHandler.GetClanMembers)

				// Promo Code redemption
				r.Post("/promo/redeem", cfg.OwnerHandler.RedeemPromo)
			})
		})
	})

	// Owner Panel Routes
	r.Route("/owner", func(r chi.Router) {
		r.Post("/auth/totp", cfg.OwnerHandler.Login)

		r.Group(func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)
			r.Use(middleware.ValidateOwnerAdmin)

			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/dashboard/stats", cfg.OwnerHandler.GetStats)

			// System Settings
			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/settings", cfg.OwnerHandler.GetSettings)
			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Put("/settings", cfg.OwnerHandler.UpdateSettings)

			r.With(middleware.RequirePermission(middleware.PermSearchUsers)).Get("/users/search", cfg.OwnerHandler.SearchUsers)
			r.With(middleware.RequirePermission(middleware.PermImpersonate)).Post("/users/impersonate", cfg.OwnerHandler.Impersonate)
			r.With(middleware.RequirePermission(middleware.PermBanUser)).Post("/users/ban", cfg.OwnerHandler.BanUser)
			r.With(middleware.RequirePermission(middleware.PermBanUser)).Post("/users/unban", cfg.OwnerHandler.UnbanUser)
			r.With(middleware.RequirePermission(middleware.PermBanUser)).Post("/users/flag", cfg.OwnerHandler.FlagUser)
			r.With(middleware.RequirePermission(middleware.PermBanUser)).Post("/users/adjust-frg", cfg.OwnerHandler.AdjustAirdropCoins)
			r.With(middleware.RequirePermission(middleware.PermAuditView)).Get("/audit-logs", cfg.OwnerHandler.GetAuditLogs)

			// Promo Code management
			r.With(middleware.RequirePermission(middleware.PermPromoManage)).Post("/promos", cfg.OwnerHandler.CreatePromo)
			r.With(middleware.RequirePermission(middleware.PermPromoManage)).Delete("/promos", cfg.OwnerHandler.DeletePromo)
			r.With(middleware.RequirePermission(middleware.PermPromoView)).Get("/promos", cfg.OwnerHandler.ListPromos)

			// Broadcasts management
			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Post("/broadcasts", cfg.OwnerHandler.CreateBroadcast)
			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/broadcasts", cfg.OwnerHandler.ListBroadcasts)

			// Dynamic Quests
			r.With(middleware.RequirePermission(middleware.PermQuestManage)).Get("/quests", cfg.OwnerHandler.ListQuests)
			r.With(middleware.RequirePermission(middleware.PermQuestManage)).Post("/quests", cfg.OwnerHandler.CreateQuest)
			r.With(middleware.RequirePermission(middleware.PermQuestManage)).Put("/quests", cfg.OwnerHandler.UpdateQuest)
			r.With(middleware.RequirePermission(middleware.PermQuestManage)).Delete("/quests", cfg.OwnerHandler.DeleteQuest)

			// Combos
			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/combos", cfg.OwnerHandler.AdminListCombos)
			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Post("/combos", cfg.OwnerHandler.AdminCreateCombo)

			// Userbots
			r.With(middleware.RequirePermission(middleware.PermUserbotManage)).Get("/userbots", cfg.OwnerHandler.ListUserbots)
			r.With(middleware.RequirePermission(middleware.PermUserbotManage)).Delete("/userbots/{id}", cfg.OwnerHandler.DeleteUserbot)
			r.With(middleware.RequirePermission(middleware.PermUserbotManage)).Post("/userbot/send-code", cfg.OwnerHandler.UserbotSendCode)
			r.With(middleware.RequirePermission(middleware.PermUserbotManage)).Post("/userbot/verify-code", cfg.OwnerHandler.UserbotVerifyCode)

			// Finance & Subscriptions
			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/finance/orders", cfg.OwnerHandler.GetFinanceOrders)
			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/finance/subscriptions", cfg.OwnerHandler.GetPremiumEntities)

			// System Health & Logs
			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/health/errors", cfg.OwnerHandler.GetSystemErrors)
			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/health/metrics", cfg.OwnerHandler.GetSystemHealthMetrics)

			// Entities (Channels & Groups)
			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/entities/channels", cfg.OwnerHandler.GetAllChannels)
			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/entities/groups", cfg.OwnerHandler.GetAllGroups)
			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Post("/entities/add-credit", cfg.OwnerHandler.AddEntityCredit)
		})
	})
}
