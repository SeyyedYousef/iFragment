package router

import (
	"ifragment-backend/internal/handler"
	"ifragment-backend/internal/middleware"
	"ifragment-backend/internal/repository"

	"github.com/go-chi/chi/v5"
)

type Config struct {
	DB                  *repository.Database
	Cache               *repository.Cache
	OwnerRepo           *repository.OwnerRepo
	SettingsRepo        *repository.SettingsRepo
	AuthHandler         *handler.AuthHandler
	UsernameHandler     *handler.UsernameHandler
	CollectionHandler   *handler.CollectionHandler
	BotMgmtHandler      *handler.BotMgmtHandler
	ChannelHandler      *handler.ChannelHandler
	ProfileHandler      *handler.ProfileHandler
	GamificationHandler *handler.GamificationHandler
	ClanHandler         *handler.ClanHandler
	WebhookHandler      *handler.WebhookHandler
	OwnerHandler        *handler.OwnerHandler
}

// RegisterAPIRoutes mounts API v1 sub-routes onto the router
func RegisterAPIRoutes(r chi.Router, cfg Config) {
	r.Route("/api/v1", func(r chi.Router) {
		r.Use(middleware.MaintenanceMiddleware(cfg.SettingsRepo))
		r.Use(middleware.BlockImpersonatedWrites)
		r.Use(middleware.UserBanCheckMiddleware(cfg.OwnerRepo))

		r.Get("/config", cfg.ProfileHandler.GetPublicConfig)

		r.Post("/webhook/telegram/{botID}", cfg.WebhookHandler.HandleTelegramWebhook)
		r.Post("/webhook/tonapi", cfg.WebhookHandler.HandleTonAPIWebhook)
		r.With(middleware.ValidateTelegramInitData(cfg.DB, cfg.Cache)).Post("/auth/token", cfg.AuthHandler.IssueToken)

		r.Route("/usernames", func(r chi.Router) {
			r.Get("/check", cfg.UsernameHandler.CheckAvailability)
			r.Get("/quick", cfg.UsernameHandler.QuickAnalysis)
			r.Get("/quick/stream", cfg.UsernameHandler.StreamQuickAnalysis)
			r.Get("/rates", cfg.UsernameHandler.GetRates)
			r.Get("/similar", cfg.UsernameHandler.GetSimilar)
			r.Get("/valuate", cfg.UsernameHandler.Valuate)
			r.Post("/share", cfg.UsernameHandler.Share)
			r.With(middleware.AuthMiddleware).Post("/send-to-chat", cfg.UsernameHandler.SendToChat)

			r.With(middleware.AuthMiddleware).Get("/valuation-access", cfg.UsernameHandler.ValuationAccess)
			r.With(middleware.AuthMiddleware).Post("/valuation-pay-airdrop", cfg.UsernameHandler.ValuationPayAirdrop)
			r.With(middleware.AuthMiddleware).Post("/valuation-pay-stars", cfg.UsernameHandler.ValuationPayStars)
			r.With(middleware.AuthMiddleware).Post("/valuation-verify-free", cfg.UsernameHandler.ValuationVerifyFree)
		})

		r.Route("/collection", func(r chi.Router) {
			r.Get("/stats", cfg.CollectionHandler.GetStats)
		})

		r.Route("/bots", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)

			r.Get("/", cfg.BotMgmtHandler.ListBots)
			r.Post("/", cfg.BotMgmtHandler.RegisterBot)
			r.Get("/{botID}", cfg.BotMgmtHandler.GetBot)
			r.Delete("/{botID}", cfg.BotMgmtHandler.RevokeBot)
			r.Get("/{botID}/groups", cfg.BotMgmtHandler.ListGroups)
		})

		r.Route("/groups", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)

			r.Get("/{groupID}", cfg.BotMgmtHandler.GetGroup)
			r.Delete("/{groupID}", cfg.BotMgmtHandler.DeleteGroup)
			r.Get("/{groupID}/settings", cfg.BotMgmtHandler.GetSettings)
			r.Put("/{groupID}/settings", cfg.BotMgmtHandler.UpdateSettings)
			r.Get("/{groupID}/analytics", cfg.BotMgmtHandler.GetAnalytics)
			r.Get("/{groupID}/audit", cfg.BotMgmtHandler.GetAuditLogs)
		})

		r.Route("/channels", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)
			r.Use(middleware.NewChannelRateLimiter(cfg.Cache))

			r.Get("/", cfg.ChannelHandler.ListChannels)
			r.Post("/connect", cfg.ChannelHandler.ConnectChannel)
			r.Get("/{channelID}", cfg.ChannelHandler.GetChannel)
			r.Delete("/{channelID}", cfg.ChannelHandler.DisconnectChannel)
			r.Get("/{channelID}/settings", cfg.ChannelHandler.GetSettings)
			r.Put("/{channelID}/settings", cfg.ChannelHandler.UpdateSettings)
			r.Get("/{channelID}/telegram-info", cfg.ChannelHandler.GetTelegramInfo)
			r.Get("/{channelID}/audit", cfg.ChannelHandler.GetAuditLogs)
			r.Get("/{channelID}/analytics", cfg.ChannelHandler.GetAnalytics)
			r.Post("/{channelID}/posts", cfg.ChannelHandler.CreatePost)
			r.Post("/{channelID}/simulate", cfg.ChannelHandler.SimulateAI)
			r.Post("/{channelID}/verify", cfg.ChannelHandler.VerifyChannel)

			r.Get("/{channelID}/funnel", cfg.ChannelHandler.GetFunnel)
			r.Post("/{channelID}/funnel", cfg.ChannelHandler.CreateFunnel)
			r.Put("/{channelID}/funnel", cfg.ChannelHandler.UpdateFunnel)
			r.Delete("/{channelID}/funnel", cfg.ChannelHandler.DeleteFunnel)

			r.Get("/{channelID}/forwarding/rules", cfg.ChannelHandler.GetForwardingRules)
			r.Get("/{channelID}/forwarding/logs", cfg.ChannelHandler.GetForwardingLogs)
			r.Get("/{channelID}/forwarding/verify", cfg.ChannelHandler.VerifyForwardingTarget)
			r.Post("/{channelID}/forwarding/rules", cfg.ChannelHandler.CreateForwardingRule)
			r.Put("/{channelID}/forwarding/rules/{ruleID}", cfg.ChannelHandler.UpdateForwardingRule)
			r.Delete("/{channelID}/forwarding/rules/{ruleID}", cfg.ChannelHandler.DeleteForwardingRule)

			r.Post("/{channelID}/admins/sync", cfg.ChannelHandler.SyncAdmins)
			r.Get("/{channelID}/admins", cfg.ChannelHandler.GetAdmins)
			r.Put("/{channelID}/admins/{adminID}", cfg.ChannelHandler.UpdateAdmin)

			r.Get("/{channelID}/members", cfg.ChannelHandler.GetMembers)
			r.Post("/{channelID}/members/{memberID}/ban", cfg.ChannelHandler.BanMember)
			r.Post("/{channelID}/members/{memberID}/restrict", cfg.ChannelHandler.RestrictMember)

			r.Get("/{channelID}/buttons", cfg.ChannelHandler.GetButtons)
			r.Post("/{channelID}/buttons", cfg.ChannelHandler.SaveButtons)
		})

		r.Route("/subscription", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)

			r.Get("/packages", cfg.BotMgmtHandler.GetPackages)
			r.Post("/subscribe", cfg.BotMgmtHandler.Subscribe)
			r.Post("/subscribe-airdrop", cfg.BotMgmtHandler.SubscribeWithAirdrop)
			r.Post("/subscribe-stars-invoice", cfg.BotMgmtHandler.SubscribeStarsInvoice)

			r.Post("/channel/subscribe", cfg.BotMgmtHandler.SubscribeChannel)
			r.Post("/channel/subscribe-airdrop", cfg.BotMgmtHandler.SubscribeChannelWithAirdrop)
			r.Post("/channel/subscribe-stars-invoice", cfg.BotMgmtHandler.SubscribeChannelStarsInvoice)
		})

		r.Route("/profile", func(r chi.Router) {
			r.Get("/avatar/{userID}", cfg.ProfileHandler.GetAvatar)
			r.Get("/public-config", cfg.ProfileHandler.GetPublicConfig)
			r.Get("/clan/photo", cfg.ClanHandler.GetClanPhotoProxy)

			r.Group(func(r chi.Router) {
				r.Use(middleware.AuthMiddleware)

				r.Post("/language", cfg.ProfileHandler.SetLanguage)
				r.Delete("/gdpr", cfg.ProfileHandler.DeleteUserDataGDPR)
				r.Get("/stats", cfg.ProfileHandler.GetStats)
				r.Get("/achievements", cfg.ProfileHandler.GetAchievements)
				r.Get("/achievements/defs", cfg.ProfileHandler.GetAchievementDefs)
				r.Get("/referral", cfg.ProfileHandler.GetReferralData)
				r.Post("/referral", cfg.ProfileHandler.SetReferrerCode)
				r.Post("/tap", cfg.ProfileHandler.AddTaps)

				r.Get("/cosmetics", cfg.ProfileHandler.GetCosmetics)
				r.Post("/cosmetics/purchase", cfg.ProfileHandler.PurchaseCosmetic)
				r.Post("/cosmetics/equip", cfg.ProfileHandler.EquipCosmetic)
				r.Post("/emoji-status", cfg.ProfileHandler.SetEmojiStatus)
				r.Post("/premium/checkout", cfg.ProfileHandler.CreatePremiumCheckout)

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

				r.Get("/clan", cfg.ClanHandler.GetClanDetails)
				r.Post("/clan/join", cfg.ClanHandler.JoinClan)
				r.Post("/clan/leave", cfg.ClanHandler.LeaveClan)
				r.Get("/clan/top", cfg.ClanHandler.GetTopClans)
				r.Get("/clans/top", cfg.ClanHandler.GetTopClans)
				r.Get("/clan/members", cfg.ClanHandler.GetClanMembers)

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

			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/settings", cfg.OwnerHandler.GetSettings)
			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Put("/settings", cfg.OwnerHandler.UpdateSettings)

			r.With(middleware.RequirePermission(middleware.PermSearchUsers)).Get("/users/search", cfg.OwnerHandler.SearchUsers)
			r.With(middleware.RequirePermission(middleware.PermImpersonate)).Post("/users/impersonate", cfg.OwnerHandler.Impersonate)
			r.With(middleware.RequirePermission(middleware.PermBanUser)).Post("/users/ban", cfg.OwnerHandler.BanUser)
			r.With(middleware.RequirePermission(middleware.PermBanUser)).Post("/users/unban", cfg.OwnerHandler.UnbanUser)
			r.With(middleware.RequirePermission(middleware.PermBanUser)).Post("/users/flag", cfg.OwnerHandler.FlagUser)
			r.With(middleware.RequirePermission(middleware.PermBanUser)).Post("/users/adjust-frg", cfg.OwnerHandler.AdjustAirdropCoins)
			r.With(middleware.RequirePermission(middleware.PermAuditView)).Get("/audit-logs", cfg.OwnerHandler.GetAuditLogs)

			r.With(middleware.RequirePermission(middleware.PermPromoManage)).Post("/promos", cfg.OwnerHandler.CreatePromo)
			r.With(middleware.RequirePermission(middleware.PermPromoManage)).Delete("/promos", cfg.OwnerHandler.DeletePromo)
			r.With(middleware.RequirePermission(middleware.PermPromoView)).Get("/promos", cfg.OwnerHandler.ListPromos)

			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Post("/broadcasts", cfg.OwnerHandler.CreateBroadcast)
			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/broadcasts", cfg.OwnerHandler.ListBroadcasts)

			r.With(middleware.RequirePermission(middleware.PermQuestManage)).Get("/quests", cfg.OwnerHandler.ListQuests)
			r.With(middleware.RequirePermission(middleware.PermQuestManage)).Post("/quests", cfg.OwnerHandler.CreateQuest)
			r.With(middleware.RequirePermission(middleware.PermQuestManage)).Put("/quests", cfg.OwnerHandler.UpdateQuest)
			r.With(middleware.RequirePermission(middleware.PermQuestManage)).Delete("/quests", cfg.OwnerHandler.DeleteQuest)

			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/combos", cfg.OwnerHandler.AdminListCombos)
			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Post("/combos", cfg.OwnerHandler.AdminCreateCombo)

			r.With(middleware.RequirePermission(middleware.PermUserbotManage)).Get("/userbots", cfg.OwnerHandler.ListUserbots)
			r.With(middleware.RequirePermission(middleware.PermUserbotManage)).Delete("/userbots/{id}", cfg.OwnerHandler.DeleteUserbot)
			r.With(middleware.RequirePermission(middleware.PermUserbotManage)).Post("/userbot/send-code", cfg.OwnerHandler.UserbotSendCode)
			r.With(middleware.RequirePermission(middleware.PermUserbotManage)).Post("/userbot/verify-code", cfg.OwnerHandler.UserbotVerifyCode)

			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/finance/orders", cfg.OwnerHandler.GetFinanceOrders)
			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/finance/subscriptions", cfg.OwnerHandler.GetPremiumEntities)

			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/health/errors", cfg.OwnerHandler.GetSystemErrors)
			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/health/metrics", cfg.OwnerHandler.GetSystemHealthMetrics)

			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/entities/channels", cfg.OwnerHandler.GetAllChannels)
			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/entities/groups", cfg.OwnerHandler.GetAllGroups)
			r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Post("/entities/add-credit", cfg.OwnerHandler.AddEntityCredit)
		})
	})
}
