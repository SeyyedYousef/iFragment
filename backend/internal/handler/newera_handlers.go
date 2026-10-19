package handler

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"ifragment-backend/internal/i18n"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/numbers/features"
)

// ============================================================================
// New-era Telegram update handlers (Bot API 9.6 → 10.3, added 2026-08-25).
//
// These run on the MAIN bot's webhook. Managed-bot events arrive here only
// for bots created through the manager flow; subscription and guest events
// apply to every managed bot.
// ============================================================================

// handleManagedBotUpdated (Bot API 9.6): a user created a bot through our
// manager flow or rotated its token. We log it; token retrieval happens via
// getManagedBotToken when the owner opens the Mini App (tokens are never
// pushed into chat).
func (h *WebhookHandler) handleManagedBotUpdated(_ context.Context, bot *repository.ManagedBot, upd *ManagedBotUpdated) {
	if upd == nil {
		return
	}
	slog.Info("managed_bot_updated event received",
		"manager_bot_id", bot.BotID,
		"managed_bot_id", upd.ManagedBot.ID,
		"managed_bot_username", upd.ManagedBot.Username,
	)
}

// handleBotSubscriptionUpdated (Bot API 10.2): a user's paid subscription to
// this bot started, renewed, expired, or was canceled.
func (h *WebhookHandler) handleBotSubscriptionUpdated(ctx context.Context, bot *repository.ManagedBot, upd *BotSubscriptionUpdated) {
	if upd == nil || bot == nil {
		return
	}
	sub := upd.Subscription

	tg := h.getBotClient(bot)
	if tg == nil {
		slog.Warn("bot_subscription_updated: cannot get bot client")
		return
	}

	var userID int64
	if sub.UserID != 0 {
		userID = sub.UserID
	}

	lang := "en"
	if userID != 0 && h.db != nil {
		if uLang, err := h.db.GetUserLanguage(ctx, userID); err == nil && uLang != "" {
			lang = i18n.DetectLanguage(uLang)
		}
	}

	switch {
	case sub.IsCanceled:
		var text string
		switch lang {
		case "fa":
			text = "💔 <b>اشتراک iFragment Pro شما لغو شد.</b>\n\nهر زمان که مایل باشید می‌توانید از طریق مینی‌اپ اشتراک خود را تمدید کنید."
		case "ru":
			text = "💔 <b>Ваша подписка iFragment Pro была отменена.</b>\n\nВы можете возобновить её в любое время через Mini App."
		case "zh":
			text = "💔 <b>您的 iFragment Pro 订阅已取消。</b>\n\n您可随时在小程序中重新开启订阅。"
		default:
			text = "💔 <b>Your iFragment Pro subscription was canceled.</b>\n\nYou can re-subscribe anytime from the Mini App."
		}
		if userID != 0 {
			_ = tg.SendMessage(ctx, userID, text, nil, nil)
		}
		slog.Info("subscription canceled", "user", userID)
	case sub.IsRenewal:
		var text string
		switch lang {
		case "fa":
			text = "🎉 <b>اشتراک iFragment Pro شما با موفقیت تمدید شد!</b>"
		case "ru":
			text = "🎉 <b>Ваша подписка iFragment Pro успешно продлена!</b>"
		case "zh":
			text = "🎉 <b>您的 iFragment Pro 订阅已成功续期！</b>"
		default:
			text = "🎉 <b>Your iFragment Pro subscription renewed!</b>\n\nEnjoy another month of premium intelligence."
		}
		if userID != 0 {
			_ = tg.SendMessage(ctx, userID, text, nil, nil)
		}
		slog.Info("subscription renewed", "user", userID)
	case sub.IsExpired:
		var text string
		switch lang {
		case "fa":
			text = "⏰ <b>مهلت اشتراک iFragment Pro شما به پایان رسید.</b>\n\nبرای حفظ قابلیت‌های ویژه، از طریق مینی‌اپ اقدام به تمدید نمایید."
		case "ru":
			text = "⏰ <b>Срок действия вашей подписки iFragment Pro истек.</b>"
		case "zh":
			text = "⏰ <b>您的 iFragment Pro 订阅已到期。</b>"
		default:
			text = "⏰ <b>Your iFragment Pro subscription expired.</b>\n\nRenew now in the app to keep your Pro features active."
		}
		if userID != 0 {
			_ = tg.SendMessage(ctx, userID, text, nil, nil)
		}
		slog.Info("subscription expired", "user", userID)
	default:
		var text string
		switch lang {
		case "fa":
			text = "👑 <b>به iFragment Pro خوش آمدید!</b>\n\nاشتراک شما فعال شد."
		case "ru":
			text = "👑 <b>Добро пожаловать в iFragment Pro!</b>\n\nВаша подписка активна."
		case "zh":
			text = "👑 <b>欢迎加入 iFragment Pro！</b>\n\n您的订阅已激活。"
		default:
			text = "👑 <b>Welcome to iFragment Pro!</b>\n\nYour subscription is active. Enjoy premium valuations & alerts."
		}
		if userID != 0 {
			_ = tg.SendMessage(ctx, userID, text, nil, nil)
		}
		slog.Info("subscription started", "user", userID)
	}
}

// handleGuestMessage (Bot API 10.0): the bot was mentioned in a chat where it
// is not a member. We answer with a tailored interactive result pointing to the
// Mini App and bot chat — localized in fa, en, ru, zh.
func (h *WebhookHandler) handleGuestMessage(ctx context.Context, bot *repository.ManagedBot, upd *GuestMessageUpdate) {
	if upd == nil || upd.GuestQueryID == "" {
		return
	}

	tg := h.getBotClient(bot)
	if tg == nil {
		return
	}

	lang := i18n.DetectLanguage(upd.From.LanguageCode)
	if upd.From.ID != 0 && h.db != nil {
		if dbLang, err := h.db.GetUserLanguage(ctx, upd.From.ID); err == nil && dbLang != "" {
			lang = i18n.DetectLanguage(dbLang)
		}
	}

	miniAppURL := os.Getenv("MINI_APP_URL")
	if miniAppURL == "" {
		miniAppURL = "https://t.me/iFragmentBot/iFragment"
	}

	text := strings.TrimSpace(upd.Message.Text)
	if text == "" {
		text = strings.TrimSpace(upd.Message.Caption)
	}

	// Remove bot username mention e.g. "@iFragmentBot"
	if bot.BotUsername != "" {
		botMention := "@" + strings.TrimPrefix(bot.BotUsername, "@")
		text = strings.TrimSpace(strings.ReplaceAll(text, botMention, ""))
	}

	sniff := SniffAsset(text)

	var article map[string]interface{}
	if sniff != nil {
		var tonRate float64
		var rateSource string
		var rateFetchedAt time.Time
		var rateStale bool
		var rateOk bool
		if h.cryptoPrice != nil {
			tonRate, rateSource, rateFetchedAt, rateStale, rateOk = h.cryptoPrice.GetTONUSDT(ctx)
		}

		var btnMiniApp, btnBotPM string
		switch lang {
		case "fa":
			btnMiniApp = "📊 مشاهده تحلیل جامع در مینی‌اپ"
			btnBotPM = "🤖 دریافت گزارش کامل در ربات"
		case "ru":
			btnMiniApp = "📊 Открыть анализ в Mini App"
			btnBotPM = "🤖 Полный отчёт в боте"
		case "zh":
			btnMiniApp = "📊 在小程序中查看完整分析"
			btnBotPM = "🤖 在机器人中获取完整报告"
		default:
			btnMiniApp = "📊 View Full Analysis in Mini App"
			btnBotPM = "🤖 Unlock Full Report in Bot"
		}

		switch sniff.Type {
		case "username":
			normUser := strings.TrimPrefix(strings.ToLower(sniff.Entity), "@")
			var valText, desc, title string
			switch lang {
			case "fa":
				title = fmt.Sprintf("🔍 کارشناسی نام کاربری: @%s", normUser)
				valText = fmt.Sprintf("🏷️ <b>کارشناسی نام کاربری: @%s</b>\n\n💎 استعلام هوشمند شاخص‌های سرمایه‌گذاری و ارزش منصفانه در iFragment آماده است.", normUser)
				desc = "مشاهده برآورد ارزش، کمیابی و نقدشوندگی در iFragment"
			case "ru":
				title = fmt.Sprintf("🔍 Оценка юзернейма: @%s", normUser)
				valText = fmt.Sprintf("🏷️ <b>Оценка юзернейма: @%s</b>\n\n💎 Интеллектуальный анализ инвестиционного грейда и стоимости готов в iFragment.", normUser)
				desc = "Справедливая цена, редкость и ликвидность в iFragment"
			case "zh":
				title = fmt.Sprintf("🔍 用户名估值: @%s", normUser)
				valText = fmt.Sprintf("🏷️ <b>用户名估值: @%s</b>\n\n💎 iFragment 智能投资评级与公允价值分析已就绪。", normUser)
				desc = "在 iFragment 查看估值、稀缺度与流动性"
			default:
				title = fmt.Sprintf("🔍 Username Appraisal: @%s", normUser)
				valText = fmt.Sprintf("🏷️ <b>Username Appraisal: @%s</b>\n\n💎 Institutional investment grade and fair value analysis is ready on iFragment.", normUser)
				desc = "View fair value, rarity, and liquidity on iFragment"
			}

			if h.avmService != nil {
				res, err := h.avmService.Valuate(ctx, normUser, tonRate)
				if err == nil && res != nil {
					expectedUSDFloat, _ := res.ExpectedUSD.Float64()
					usdFormatted := formatUSDT(expectedUSDFloat, rateOk && tonRate > 0, lang)
					rateRefLine := buildRateReferenceLine(tonRate, rateSource, rateFetchedAt, rateStale, rateOk && tonRate > 0, lang)

					switch lang {
					case "fa":
						valText = fmt.Sprintf("🏷️ <b>کارشناسی نام کاربری: @%s</b>\n\n💎 درجه سرمایه‌گذاری: <b>%s</b>\n💰 برآورد منصفانه: <b>~%s TON (معادل %s)</b>\n📈 شاخص برندپذیری: <b>%d / 100</b>\n⚡ رتبه نقدشوندگی: <b>%s</b>\n%s\n\n🔍 <i>تحلیل دقیق الگوریتمی موتور هوشمند AVM در فرگمنت</i>",
							normUser, res.InvestmentGrade, res.ExpectedTON.StringFixed(1), usdFormatted, res.Brandability, res.LiquidityRating, rateRefLine)
						desc = fmt.Sprintf("ارزش منصفانه: ~%s TON (%s) | درجه: %s", res.ExpectedTON.StringFixed(1), usdFormatted, res.InvestmentGrade)
					case "ru":
						valText = fmt.Sprintf("🏷️ <b>Оценка юзернейма: @%s</b>\n\n💎 Инвест-грейд: <b>%s</b>\n💰 Справедливая цена: <b>~%s TON (%s)</b>\n📈 Бренд-индекс: <b>%d / 100</b>\n⚡ Ликвидность: <b>%s</b>\n%s\n\n🔍 <i>Алгоритмическая оценка AVM Engine</i>",
							normUser, res.InvestmentGrade, res.ExpectedTON.StringFixed(1), usdFormatted, res.Brandability, res.LiquidityRating, rateRefLine)
						desc = fmt.Sprintf("Справедливая: ~%s TON (%s) | Грейд: %s", res.ExpectedTON.StringFixed(1), usdFormatted, res.InvestmentGrade)
					case "zh":
						valText = fmt.Sprintf("🏷️ <b>用户名估值: @%s</b>\n\n💎 投资评级: <b>%s</b>\n💰 公允价值: <b>~%s TON (%s)</b>\n📈 品牌指数: <b>%d / 100</b>\n⚡ 流动性: <b>%s</b>\n%s\n\n🔍 <i>AVM 智能算法精准估值</i>",
							normUser, res.InvestmentGrade, res.ExpectedTON.StringFixed(1), usdFormatted, res.Brandability, res.LiquidityRating, rateRefLine)
						desc = fmt.Sprintf("公允价值: ~%s TON (%s) | 评级: %s", res.ExpectedTON.StringFixed(1), usdFormatted, res.InvestmentGrade)
					default:
						valText = fmt.Sprintf("🏷️ <b>Username Appraisal: @%s</b>\n\n💎 Investment Grade: <b>%s</b>\n💰 Fair Value: <b>~%s TON (%s)</b>\n📈 Brandability: <b>%d / 100</b>\n⚡ Liquidity: <b>%s</b>\n%s\n\n🔍 <i>Powered by iFragment AVM Engine</i>",
							normUser, res.InvestmentGrade, res.ExpectedTON.StringFixed(1), usdFormatted, res.Brandability, res.LiquidityRating, rateRefLine)
						desc = fmt.Sprintf("Fair Value: ~%s TON (%s) | Grade: %s", res.ExpectedTON.StringFixed(1), usdFormatted, res.InvestmentGrade)
					}
				}
			}

			article = map[string]interface{}{
				"type":        "article",
				"id":          "guest-username-" + normUser,
				"title":       title,
				"description": desc,
				"input_message_content": map[string]interface{}{
					"message_text": valText,
					"parse_mode":   "HTML",
				},
				"reply_markup": map[string]interface{}{
					"inline_keyboard": [][]map[string]interface{}{
						{
							{"text": btnMiniApp, "url": fmt.Sprintf("%s?startapp=val_%s", miniAppURL, normUser)},
						},
						{
							{"text": btnBotPM, "url": fmt.Sprintf("https://t.me/%s?start=username_%s", bot.BotUsername, normUser)},
						},
					},
				},
			}

		case "number":
			cleanNum := features.CleanNumber(sniff.Entity)
			var valText, desc, title string
			switch lang {
			case "fa":
				title = fmt.Sprintf("📱 کارشناسی شماره: %s", sniff.Entity)
				valText = fmt.Sprintf("📱 <b>کارشناسی شماره کلکسیونی: %s</b>\n\n💎 ارزیابی رتبه شبکه TON، کلوپ اختصاصی و قیمت منصفانه در دسترس است.", sniff.Entity)
				desc = "برآورد ارزش و رتبه کمیابی در میان ۱۳۶,۵۶۶ شماره"
			case "ru":
				title = fmt.Sprintf("📱 Оценка номера: %s", sniff.Entity)
				valText = fmt.Sprintf("📱 <b>Оценка анонимного номера: %s</b>\n\n💎 Анализ ранга редкости TON, клуба паттерна и справедливой цены.", sniff.Entity)
				desc = "Оценка стоимости и ранг среди 136,566 номеров"
			case "zh":
				title = fmt.Sprintf("📱 匿名号码评估: %s", sniff.Entity)
				valText = fmt.Sprintf("📱 <b>匿名靓号评估: %s</b>\n\n💎 TON 链上稀缺度排名、专属俱乐部与公允价值分析。", sniff.Entity)
				desc = "136,566 个号码中的估值与稀缺排名"
			default:
				title = fmt.Sprintf("📱 Number Appraisal: %s", sniff.Entity)
				valText = fmt.Sprintf("📱 <b>Collectible Number Appraisal: %s</b>\n\n💎 TON network rarity rank, pattern club, and fair value estimate.", sniff.Entity)
				desc = "Fair value & rarity rank among 136,566 numbers"
			}

			if h.numbersService != nil {
				val, err := h.numbersService.ValuateNumber(ctx, 0, sniff.Entity)
				if err == nil && val != nil {
					club := val.CategoryClub
					if lang == "fa" && val.CategoryClubFa != "" {
						club = val.CategoryClubFa
					}
					usdFormatted := formatUSDT(val.ExpectedUSD, rateOk && tonRate > 0, lang)
					rateRefLine := buildRateReferenceLine(tonRate, rateSource, rateFetchedAt, rateStale, rateOk && tonRate > 0, lang)

					switch lang {
					case "fa":
						valText = fmt.Sprintf("📱 <b>کارشناسی شماره کلکسیونی: %s</b>\n\n👑 کلوپ: <b>%s</b>\n🏆 رتبه کمیابی: <b>#%d از ۱۳۶,۵۶۶</b>\n💰 قیمت منصفانه (Fair): <b>%s TON (%s)</b>\n🎯 ضریب اطمینان: <b>%d%%</b>\n%s\n\n⚡ <i>ارزیابی دقیق موتور NV Engine بر اساس متدولوژی ثبت‌شده در TON</i>",
							val.DisplayNumber, club, val.GlobalRank, val.ExpectedTON.StringFixed(1), usdFormatted, val.ConfidenceScore, rateRefLine)
						desc = fmt.Sprintf("کلوپ: %s | قیمت منصفانه: %s TON (%s)", club, val.ExpectedTON.StringFixed(1), usdFormatted)
					case "ru":
						valText = fmt.Sprintf("📱 <b>Оценка номера: %s</b>\n\n👑 Клуб: <b>%s</b>\n🏆 Ранг редкости: <b>#%d из 136,566</b>\n💰 Справедливая цена: <b>%s TON (%s)</b>\n🎯 Точность: <b>%d%%</b>\n%s\n\n⚡ <i>Оценка NV Engine на блокчейне TON</i>",
							val.DisplayNumber, club, val.GlobalRank, val.ExpectedTON.StringFixed(1), usdFormatted, val.ConfidenceScore, rateRefLine)
						desc = fmt.Sprintf("Клуб: %s | Справедливая: %s TON (%s)", club, val.ExpectedTON.StringFixed(1), usdFormatted)
					case "zh":
						valText = fmt.Sprintf("📱 <b>匿名靓号评估: %s</b>\n\n👑 俱乐部: <b>%s</b>\n🏆 稀缺度排名: <b>#%d / 136,566</b>\n💰 公允价值: <b>%s TON (%s)</b>\n🎯 置信度: <b>%d%%</b>\n%s\n\n⚡ <i>基于 TON 链上数据的 NV Engine 精准估值</i>",
							val.DisplayNumber, club, val.GlobalRank, val.ExpectedTON.StringFixed(1), usdFormatted, val.ConfidenceScore, rateRefLine)
						desc = fmt.Sprintf("俱乐部: %s | 公允价值: %s TON (%s)", club, val.ExpectedTON.StringFixed(1), usdFormatted)
					default:
						valText = fmt.Sprintf("📱 <b>Collectible Number Appraisal: %s</b>\n\n👑 Club: <b>%s</b>\n🏆 Rarity Rank: <b>#%d of 136,566</b>\n💰 Fair Value: <b>%s TON (%s)</b>\n🎯 Confidence: <b>%d%%</b>\n%s\n\n⚡ <i>Powered by iFragment NV Engine on TON</i>",
							val.DisplayNumber, club, val.GlobalRank, val.ExpectedTON.StringFixed(1), usdFormatted, val.ConfidenceScore, rateRefLine)
						desc = fmt.Sprintf("Club: %s | Fair Value: %s TON (%s)", club, val.ExpectedTON.StringFixed(1), usdFormatted)
					}
				}
			}

			article = map[string]interface{}{
				"type":        "article",
				"id":          "guest-num-" + cleanNum,
				"title":       title,
				"description": desc,
				"input_message_content": map[string]interface{}{
					"message_text": valText,
					"parse_mode":   "HTML",
				},
				"reply_markup": map[string]interface{}{
					"inline_keyboard": [][]map[string]interface{}{
						{
							{"text": btnMiniApp, "url": fmt.Sprintf("%s?startapp=num_%s", miniAppURL, cleanNum)},
						},
						{
							{"text": btnBotPM, "url": fmt.Sprintf("https://t.me/%s?start=number_%s", bot.BotUsername, cleanNum)},
						},
					},
				},
			}

		case "gift":
			var valText, desc, title string
			switch lang {
			case "fa":
				title = fmt.Sprintf("🎁 کارشناسی گیفت: %s", sniff.Entity)
				valText = fmt.Sprintf("🎁 <b>تحلیل گیفت تلگرام: %s</b>\n\n💎 بررسی زنده کف قیمت بازار، کمیابی ژنتیکی صفات و تحلیل منصفانه فرگمنت.", sniff.Entity)
				desc = "کف قیمت زنده، ویژگی‌های صفات و ارزش‌گذاری"
			case "ru":
				title = fmt.Sprintf("🎁 Оценка подарка: %s", sniff.Entity)
				valText = fmt.Sprintf("🎁 <b>Анализ подарка Telegram: %s</b>\n\n💎 Текущий Floor, генетика атрибутов и справедливая оценка.", sniff.Entity)
				desc = "Floor-цена, редкость атрибутов и оценка"
			case "zh":
				title = fmt.Sprintf("🎁 礼物鉴定: %s", sniff.Entity)
				valText = fmt.Sprintf("🎁 <b>Telegram 礼物分析: %s</b>\n\n💎 实时市场底价、特征基因稀缺度与公允估值。", sniff.Entity)
				desc = "实时底价、基因特征与公允估值"
			default:
				title = fmt.Sprintf("🎁 Gift Appraisal: %s", sniff.Entity)
				valText = fmt.Sprintf("🎁 <b>Telegram Gift Analysis: %s</b>\n\n💎 Live market floor, trait DNA rarity, and fair value appraisal.", sniff.Entity)
				desc = "Live floor price, trait DNA & fair valuation"
			}

			if h.giftsService != nil {
				appraisal, err := h.giftsService.GetBotGiftAppraisal(ctx, sniff.Entity)
				if err == nil && appraisal != nil {
					fairTON := appraisal.Pillars.FairValueGRAM
					floorTON := appraisal.Pillars.ObservedFloorGRAM
					usdFormatted := formatUSDT(appraisal.ExpectedUSD, rateOk && tonRate > 0, lang)
					rateRefLine := buildRateReferenceLine(tonRate, rateSource, rateFetchedAt, rateStale, rateOk && tonRate > 0, lang)

					switch lang {
					case "fa":
						valText = fmt.Sprintf("🎁 <b>کارشناسی گیفت تلگرام: %s</b>\n\n💎 ارزش منصفانه: <b>%.1f TON (%s)</b>\n🌊 کف قیمت بازار: <b>%.1f TON</b>\n#️⃣ شماره سریال: <b>#%d</b>\n🎯 ضریب اطمینان: <b>%d%%</b>\n%s\n\n⚡ <i>ارزیابی ۴ پایه‌ای موتور GV Engine بر پایه داده‌های آن‌چین</i>",
							appraisal.DisplayTitle, fairTON, usdFormatted, floorTON, appraisal.SerialNumber, appraisal.ConfidenceScore, rateRefLine)
						desc = fmt.Sprintf("ارزش منصفانه: %.1f TON (%s) | کف: %.1f TON | سریال #%d", fairTON, usdFormatted, floorTON, appraisal.SerialNumber)
					case "ru":
						valText = fmt.Sprintf("🎁 <b>Оценка подарка Telegram: %s</b>\n\n💎 Справедливая цена: <b>%.1f TON (%s)</b>\n🌊 Рыночный Floor: <b>%.1f TON</b>\n#️⃣ Серия: <b>#%d</b>\n🎯 Точность: <b>%d%%</b>\n%s\n\n⚡ <i>4-факторная оценка GV Engine на базе он-чейн данных</i>",
							appraisal.DisplayTitle, fairTON, usdFormatted, floorTON, appraisal.SerialNumber, appraisal.ConfidenceScore, rateRefLine)
						desc = fmt.Sprintf("Справедливая: %.1f TON (%s) | Floor: %.1f TON | #%d", fairTON, usdFormatted, floorTON, appraisal.SerialNumber)
					case "zh":
						valText = fmt.Sprintf("🎁 <b>Telegram 礼物鉴定: %s</b>\n\n💎 公允价值: <b>%.1f TON (%s)</b>\n🌊 市场底价: <b>%.1f TON</b>\n#️⃣ 编号: <b>#%d</b>\n🎯 置信度: <b>%d%%</b>\n%s\n\n⚡ <i>GV Engine 四维链上估值模型</i>",
							appraisal.DisplayTitle, fairTON, usdFormatted, floorTON, appraisal.SerialNumber, appraisal.ConfidenceScore, rateRefLine)
						desc = fmt.Sprintf("公允价值: %.1f TON (%s) | 底价: %.1f TON | #%d", fairTON, usdFormatted, floorTON, appraisal.SerialNumber)
					default:
						valText = fmt.Sprintf("🎁 <b>Telegram Gift Appraisal: %s</b>\n\n💎 Fair Value: <b>%.1f TON (%s)</b>\n🌊 Market Floor: <b>%.1f TON</b>\n#️⃣ Serial: <b>#%d</b>\n🎯 Confidence: <b>%d%%</b>\n%s\n\n⚡ <i>4-Pillar GV Engine On-Chain Valuation</i>",
							appraisal.DisplayTitle, fairTON, usdFormatted, floorTON, appraisal.SerialNumber, appraisal.ConfidenceScore, rateRefLine)
						desc = fmt.Sprintf("Fair Value: %.1f TON (%s) | Floor: %.1f TON | #%d", fairTON, usdFormatted, floorTON, appraisal.SerialNumber)
					}
				}
			}

			article = map[string]interface{}{
				"type":        "article",
				"id":          "guest-gift-" + sniff.Entity,
				"title":       title,
				"description": desc,
				"input_message_content": map[string]interface{}{
					"message_text": valText,
					"parse_mode":   "HTML",
				},
				"reply_markup": map[string]interface{}{
					"inline_keyboard": [][]map[string]interface{}{
						{
							{"text": btnMiniApp, "url": fmt.Sprintf("%s?startapp=gift_%s", miniAppURL, sniff.Entity)},
						},
						{
							{"text": btnBotPM, "url": fmt.Sprintf("https://t.me/%s?start=gift_%s", bot.BotUsername, sniff.Entity)},
						},
					},
				},
			}
		}
	}

	if article == nil {
		var title, desc, msgText, btnOpen string
		switch lang {
		case "fa":
			title = "iFragment — هوش بازار و کارشناسی تلگرام"
			desc = "کارشناسی ارزش نام کاربری، شماره +888 و گیفت‌ها. با منشن کردن استعلام بگیرید!"
			msgText = "💎 <b>iFragment</b> — سیستم ارزیابی و اطلاعات بازار دارایی‌های تلگرام.\n\nاستعلام در هر گروه با منشن: <code>@" + bot.BotUsername + " durov</code> یا ورود به مینی‌اپ:"
			btnOpen = "🚀 باز کردن iFragment"
		case "ru":
			title = "iFragment — Аналитика активов Telegram"
			desc = "Оценка юзернеймов, номеров +888 и подарков NFT."
			msgText = "💎 <b>iFragment</b> — терминал оценки и рыночной аналитики цифровых активов Telegram.\n\nУпомяните бота: <code>@" + bot.BotUsername + " durov</code> или откройте Mini App:"
			btnOpen = "🚀 Открыть iFragment"
		case "zh":
			title = "iFragment — Telegram 资产智能估值"
			desc = "评估用户名、+888 匿名号码与礼物 NFT。"
			msgText = "💎 <b>iFragment</b> — Telegram 数字资产估值与市场分析终端。\n\n在任意群组提及: <code>@" + bot.BotUsername + " durov</code> 或打开小程序："
			btnOpen = "🚀 打开 iFragment"
		default:
			title = "iFragment — Telegram Asset Intelligence"
			desc = "Appraise usernames, +888 numbers, and gifts. Mention the bot to scan!"
			msgText = "💎 <b>iFragment</b> — Institutional valuation & market intelligence for Telegram Digital Assets.\n\nMention in any chat: <code>@" + bot.BotUsername + " durov</code> or launch the Mini App:"
			btnOpen = "🚀 Launch iFragment"
		}

		article = map[string]interface{}{
			"type":        "article",
			"id":          "guest-intro",
			"title":       title,
			"description": desc,
			"input_message_content": map[string]interface{}{
				"message_text": msgText,
				"parse_mode":   "HTML",
			},
			"reply_markup": map[string]interface{}{
				"inline_keyboard": [][]map[string]interface{}{
					{
						{"text": btnOpen, "url": miniAppURL},
					},
				},
			},
		}
	}

	if err := tg.AnswerGuestQuery(ctx, upd.GuestQueryID, []map[string]interface{}{article}, 300); err != nil {
		slog.Warn("answerGuestQuery failed", "error", err)
	} else {
		slog.Info("guest query answered successfully", "from_user", upd.From.ID, "chat_type", upd.Message.Chat.Type)
	}
}
