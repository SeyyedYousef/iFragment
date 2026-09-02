package router

import (
	"net/http"
	"time"

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
	NumbersHandler      *handler.NumbersHandler
	GiftsHandler        *handler.GiftsHandler
	ProjectHandler      *handler.ProjectHandler
	IntelCreditHandler  *handler.IntelCreditHandler
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
		r.Post("/auth/refresh", cfg.AuthHandler.RefreshToken)

		r.Route("/usernames", func(r chi.Router) {
			r.Get("/check", cfg.UsernameHandler.CheckAvailability)
			r.With(middleware.OptionalAuthMiddleware).Get("/quick", cfg.UsernameHandler.QuickAnalysis)
			r.With(middleware.OptionalAuthMiddleware).Get("/quick/stream", cfg.UsernameHandler.StreamQuickAnalysis)
			r.Get("/rates", cfg.UsernameHandler.GetRates)
			r.Get("/similar", cfg.UsernameHandler.GetSimilar)
			r.Get("/calibration", cfg.UsernameHandler.GetAVMCalibration)
			r.With(middleware.AuthMiddleware).Get("/valuate", cfg.UsernameHandler.Valuate)
			r.Post("/share", cfg.UsernameHandler.Share)
			r.With(middleware.AuthMiddleware).Post("/send-to-chat", cfg.UsernameHandler.SendToChat)

			r.With(middleware.AuthMiddleware).Get("/valuation-access", cfg.UsernameHandler.ValuationAccess)
			r.With(middleware.AuthMiddleware).Get("/valuation-order-status", cfg.UsernameHandler.ValuationOrderStatus)
			r.With(middleware.AuthMiddleware).Post("/valuation-pay-airdrop", cfg.UsernameHandler.ValuationPayAirdrop)
			r.With(middleware.AuthMiddleware).Post("/valuation-pay-stars", cfg.UsernameHandler.ValuationPayStars)
			r.With(middleware.AuthMiddleware).Post("/valuation-verify-free", cfg.UsernameHandler.ValuationVerifyFree)
			r.With(middleware.AuthMiddleware).Post("/valuation-monitor", cfg.UsernameHandler.ValuationMonitor)
		})

		r.Route("/orders", func(r chi.Router) {
			r.Use(middleware.OptionalAuthMiddleware)
			r.Get("/{id}/status", cfg.UsernameHandler.GetOrderStatus)
			r.Get("/by-payload/{payload}/status", cfg.UsernameHandler.GetOrderStatusByPayload)
		})

		r.Route("/numbers", func(r chi.Router) {
			r.Get("/list", cfg.NumbersHandler.GetNumbersList)
			r.Get("/verify", cfg.NumbersHandler.Verify)
			r.Get("/intel", cfg.NumbersHandler.GetIntel)
			r.Get("/chart-data", cfg.NumbersHandler.GetChartData)
			r.Get("/gate", cfg.NumbersHandler.GetCuriosityGate)
			r.Get("/mask", cfg.NumbersHandler.SearchMask)
			r.Get("/deals", cfg.NumbersHandler.GetDeals)
			r.Get("/clubs", cfg.NumbersHandler.GetClubs)
			r.With(middleware.NewStrictRateLimiter(cfg.Cache, 15, time.Minute)).Get("/portfolio", cfg.NumbersHandler.ScanPortfolio)
			r.Get("/activity", cfg.NumbersHandler.GetLiveActivity)
			r.With(middleware.OptionalAuthMiddleware).Get("/valuate", cfg.NumbersHandler.Valuate)
			r.With(middleware.AuthMiddleware).Post("/unlock-coins", cfg.NumbersHandler.UnlockWithCoins)
			r.With(middleware.AuthMiddleware).Post("/unlock-credit", cfg.NumbersHandler.UnlockWithCredit)
			r.With(middleware.AuthMiddleware).Post("/watchlist", cfg.NumbersHandler.ToggleWatchlist)
			r.With(middleware.AuthMiddleware).Get("/watchlist", cfg.NumbersHandler.GetWatchlist)
		})

		if cfg.GiftsHandler != nil {
			r.Route("/gifts", func(r chi.Router) {
				r.Get("/intel", cfg.GiftsHandler.GetIntel)
				r.Get("/collections", cfg.GiftsHandler.ListCollections)
				r.Get("/collection-intel", cfg.GiftsHandler.GetCollectionIntel)
				r.Get("/gate", cfg.GiftsHandler.GetCuriosityGate)
				r.Get("/upgrade-advice", cfg.GiftsHandler.GetUpgradeAdvice)
				r.Get("/portfolio", cfg.GiftsHandler.ScanPortfolio)
				r.Post("/crafting-ev", cfg.GiftsHandler.CalculateCraftingEV)
				r.Get("/image/{slug}", cfg.GiftsHandler.GetGiftImage)
				r.With(middleware.OptionalAuthMiddleware).Get("/valuate", cfg.GiftsHandler.Valuate)
				r.With(middleware.AuthMiddleware).Post("/unlock-coins", cfg.GiftsHandler.UnlockWithCoins)
				r.With(middleware.AuthMiddleware).Post("/unlock-credit", cfg.GiftsHandler.UnlockWithCredit)
				r.With(middleware.AuthMiddleware).Post("/watchlist", cfg.GiftsHandler.ToggleWatchlist)
				r.With(middleware.AuthMiddleware).Get("/watchlist", cfg.GiftsHandler.GetWatchlist)
			})
		}

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
			r.Get("/{groupID}/telegram-info", cfg.BotMgmtHandler.GetGroupTelegramInfo)
			r.Get("/{groupID}/members/warnings", cfg.BotMgmtHandler.ListGroupWarnings)
			r.Post("/{groupID}/members/warnings/{targetUserID}/reset", cfg.BotMgmtHandler.ResetGroupWarnings)
			r.Post("/{groupID}/members/restrict", cfg.BotMgmtHandler.RestrictMemberManual)
			r.Post("/{groupID}/members/unban", cfg.BotMgmtHandler.UnbanMember)
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
			r.Get("/{channelID}/health", cfg.ChannelHandler.GetChannelHealth)
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
			r.Post("/{channelID}/webhooks/ping", cfg.ChannelHandler.PingWebhook)

			r.Post("/{channelID}/admins/sync", cfg.ChannelHandler.SyncAdmins)
			r.Get("/{channelID}/admins", cfg.ChannelHandler.GetAdmins)
			r.Put("/{channelID}/admins/{adminID}", cfg.ChannelHandler.UpdateAdmin)

			r.Get("/{channelID}/members", cfg.ChannelHandler.GetMembers)
			r.Post("/{channelID}/members/{memberID}/ban", cfg.ChannelHandler.BanMember)
			r.Post("/{channelID}/members/{memberID}/restrict", cfg.ChannelHandler.RestrictMember)

			r.Get("/{channelID}/buttons", cfg.ChannelHandler.GetButtons)
			r.Post("/{channelID}/buttons", cfg.ChannelHandler.SaveButtons)
			r.Put("/{channelID}/inline-buttons", cfg.ChannelHandler.SaveInlineButtonsAtomic)
		})

		r.Route("/projects", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)

			if cfg.ProjectHandler != nil {
				r.Get("/", cfg.ProjectHandler.ListProjects)
				r.Post("/", cfg.ProjectHandler.CreateProject)
				r.Get("/{projectID}", cfg.ProjectHandler.GetProject)
				r.Put("/{projectID}", cfg.ProjectHandler.UpdateProject)
				r.Post("/{projectID}/toggle", cfg.ProjectHandler.ToggleProject)
				r.Post("/{projectID}/renew", cfg.ProjectHandler.RenewProject)
				r.Delete("/{projectID}", cfg.ProjectHandler.DeleteProject)
			}
		})

		r.Route("/subscription", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)

			r.Get("/packages", cfg.BotMgmtHandler.GetPackages)
			r.Post("/subscribe", cfg.BotMgmtHandler.Subscribe)
			r.Post("/subscribe-airdrop", cfg.BotMgmtHandler.SubscribeWithAirdrop)
			r.Post("/subscribe-credits", cfg.BotMgmtHandler.SubscribeWithCredits)
			r.Post("/subscribe-stars-invoice", cfg.BotMgmtHandler.SubscribeStarsInvoice)

			r.Post("/channel/subscribe", cfg.BotMgmtHandler.SubscribeChannel)
			r.Post("/channel/subscribe-airdrop", cfg.BotMgmtHandler.SubscribeChannelWithAirdrop)
			r.Post("/channel/subscribe-credits", cfg.BotMgmtHandler.SubscribeChannelWithCredits)
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
				r.Get("/wallet-expiry", cfg.ProfileHandler.GetWalletExpirySummary)
				r.Get("/ledger", cfg.ProfileHandler.GetLedger)
				r.Get("/assets", cfg.ProfileHandler.GetMyAssets)
				r.Get("/sessions", cfg.AuthHandler.GetSessions)
				r.Post("/sessions/revoke-all", cfg.AuthHandler.RevokeAllSessions)

				r.Get("/cosmetics", cfg.ProfileHandler.GetCosmetics)
				r.Post("/cosmetics/purchase", cfg.ProfileHandler.PurchaseCosmetic)
				r.Post("/cosmetics/equip", cfg.ProfileHandler.EquipCosmetic)
				r.Post("/emoji-status", cfg.ProfileHandler.SetEmojiStatus)
				r.Post("/emoji-status/claim-reward", cfg.ProfileHandler.ClaimEmojiStatusReward)
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

		r.Route("/marketplace", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)
			r.Get("/options", cfg.ProfileHandler.GetMarketplaceOptions)
			r.Post("/buy-stars", cfg.ProfileHandler.BuyStarsMarketplace)
			r.Post("/convert", cfg.ProfileHandler.ConvertAirdropCoins)
		})

		r.Route("/frg", func(r chi.Router) {
			r.Use(middleware.AuthMiddleware)
			r.Get("/balance", cfg.ProfileHandler.GetFRGBalance)
			r.Get("/transactions", cfg.ProfileHandler.GetFRGTransactions)
		})

		// Intel Credits System
		if cfg.IntelCreditHandler != nil {
			r.Route("/intel", func(r chi.Router) {
				r.Use(middleware.AuthMiddleware)
				r.Get("/credits", cfg.IntelCreditHandler.GetBalance)
				r.Post("/credits/consume", cfg.IntelCreditHandler.Consume)
				r.Get("/credits/config", cfg.IntelCreditHandler.GetStoreConfig)
				r.Post("/credits/exchange-coins", cfg.IntelCreditHandler.ExchangeCoins)
				r.Post("/credits/purchase", cfg.IntelCreditHandler.Purchase)
			})
		}

		// Public Ads Endpoints
		if cfg.OwnerHandler != nil {
			r.Get("/ads/active", cfg.OwnerHandler.GetActiveAds)
			r.Post("/ads/{id}/impression", cfg.OwnerHandler.TrackAdImpression)
			r.Post("/ads/{id}/click", cfg.OwnerHandler.TrackAdClick)
		}

		// Public uploads media serving fallback
		r.Handle("/uploads/*", http.StripPrefix("/api/v1/uploads/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			http.FileServer(http.Dir("./uploads")).ServeHTTP(w, r)
		})))

		// Owner Panel Routes
		r.Route("/owner", func(r chi.Router) {
			r.Group(func(r chi.Router) {
				r.Use(middleware.NewStrictRateLimiter(cfg.Cache, 5, time.Minute))
				r.Post("/auth/login", cfg.OwnerHandler.Login)
				r.Post("/auth/totp/verify", cfg.OwnerHandler.VerifyTOTP)
			})

			r.Group(func(r chi.Router) {
				r.Use(middleware.AuthMiddleware)
				r.Use(middleware.ValidateOwnerAdmin)

				// TOTP Management
				r.Post("/auth/totp/setup", cfg.OwnerHandler.SetupTOTP)
				r.Post("/auth/totp/verify-setup", cfg.OwnerHandler.VerifyTOTPSetup)
				r.Post("/auth/totp/disable", cfg.OwnerHandler.DisableTOTP)

				// Dashboard & Settings
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/dashboard/stats", cfg.OwnerHandler.GetDashboardStats)
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/settings", cfg.OwnerHandler.GetSettings)
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Put("/settings", cfg.OwnerHandler.UpdateSettings)

				// Users
				r.With(middleware.RequirePermission(middleware.PermSearchUsers)).Get("/users/search", cfg.OwnerHandler.SearchUsers)
				r.With(middleware.RequirePermission(middleware.PermImpersonate)).Post("/users/impersonate", cfg.OwnerHandler.Impersonate)
				r.With(middleware.RequirePermission(middleware.PermImpersonate)).Post("/users/impersonate/end", cfg.OwnerHandler.EndImpersonation)
				r.With(middleware.RequirePermission(middleware.PermBanUser)).Post("/users/ban", cfg.OwnerHandler.BanUser)
				r.With(middleware.RequirePermission(middleware.PermBanUser)).Post("/users/unban", cfg.OwnerHandler.UnbanUser)
				r.With(middleware.RequirePermission(middleware.PermBanUser)).Post("/users/flag", cfg.OwnerHandler.FlagUser)
				r.With(middleware.RequirePermission(middleware.PermBanUser)).Post("/users/adjust-balance", cfg.OwnerHandler.AdjustBalance)
				r.With(middleware.RequirePermission(middleware.PermBanUser)).Post("/users/adjust-frg", cfg.OwnerHandler.AdjustBalance)
				r.With(middleware.RequirePermission(middleware.PermAuditView)).Get("/audit-logs", cfg.OwnerHandler.GetAuditLogs)

				// Promos
				r.With(middleware.RequirePermission(middleware.PermPromoManage)).Post("/promos", cfg.OwnerHandler.CreatePromo)
				r.With(middleware.RequirePermission(middleware.PermPromoManage)).Delete("/promos/{code}", cfg.OwnerHandler.DeletePromo)
				r.With(middleware.RequirePermission(middleware.PermPromoView)).Get("/promos", cfg.OwnerHandler.ListPromos)

				// Broadcasts
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Post("/broadcasts", cfg.OwnerHandler.CreateBroadcast)
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/broadcasts", cfg.OwnerHandler.ListBroadcasts)
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/broadcasts/audience-count", cfg.OwnerHandler.GetAudienceCount)
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Post("/broadcasts/{id}/pause", cfg.OwnerHandler.PauseBroadcast)
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Post("/broadcasts/{id}/resume", cfg.OwnerHandler.ResumeBroadcast)
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Post("/broadcasts/{id}/cancel", cfg.OwnerHandler.CancelBroadcast)

				// Quests
				r.With(middleware.RequirePermission(middleware.PermQuestManage)).Get("/quests", cfg.OwnerHandler.ListQuests)
				r.With(middleware.RequirePermission(middleware.PermQuestManage)).Post("/quests", cfg.OwnerHandler.CreateQuest)
				r.With(middleware.RequirePermission(middleware.PermQuestManage)).Put("/quests/{key}", cfg.OwnerHandler.UpdateQuest)
				r.With(middleware.RequirePermission(middleware.PermQuestManage)).Delete("/quests/{key}", cfg.OwnerHandler.DeleteQuest)

				// Daily Combos
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/combos", cfg.OwnerHandler.ListCombos)
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Post("/combos", cfg.OwnerHandler.UpsertCombo)

				// Ads Management & Media Pipeline
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Post("/ads/upload", cfg.OwnerHandler.UploadAdImage)
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/ads", cfg.OwnerHandler.ListAdCampaigns)
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Post("/ads", cfg.OwnerHandler.CreateAdCampaign)
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Put("/ads/{id}", cfg.OwnerHandler.UpdateAdCampaign)
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Delete("/ads/{id}", cfg.OwnerHandler.DeleteAdCampaign)

				// Userbots
				r.With(middleware.RequirePermission(middleware.PermUserbotManage)).Get("/userbots", cfg.OwnerHandler.ListUserbots)
				r.With(middleware.RequirePermission(middleware.PermUserbotManage)).Delete("/userbots/{id}", cfg.OwnerHandler.DeleteUserbot)
				r.With(middleware.RequirePermission(middleware.PermUserbotManage)).Post("/userbot/send-code", cfg.OwnerHandler.UserbotSendCode)
				r.With(middleware.RequirePermission(middleware.PermUserbotManage)).Post("/userbot/verify-code", cfg.OwnerHandler.UserbotVerifyCode)

				// Finance
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/finance/summary", cfg.OwnerHandler.GetFinanceSummary)
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/finance/orders", cfg.OwnerHandler.GetOrdersList)
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/finance/subscriptions", cfg.OwnerHandler.GetPremiumEntities)

				// Health
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/health/errors", cfg.OwnerHandler.GetSystemErrors)
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/health/metrics", cfg.OwnerHandler.GetHealth)

				// Entities
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/entities/channels", cfg.OwnerHandler.GetAllChannels)
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Get("/entities/groups", cfg.OwnerHandler.GetAllGroups)
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Post("/entities/extend-subscription", cfg.OwnerHandler.ExtendEntitySubscription)
				r.With(middleware.RequirePermission(middleware.PermViewDashboard)).Post("/entities/grant-coins", cfg.OwnerHandler.GrantEntityCoins)
			})
		})
	})
}
