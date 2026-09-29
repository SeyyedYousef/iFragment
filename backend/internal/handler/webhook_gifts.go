package handler

import (
	"context"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/crypto"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/gifts/gvengine"
)

var giftLinkRegex = regexp.MustCompile(`(?i)(?:https?://)?(?:t\.me/nft/|fragment\.com/gift/)([a-zA-Z0-9_\-]+)`)

// handleGiftCommand processes /gift [id/name] [serial]
func (h *WebhookHandler) handleGiftCommand(ctx context.Context, bot *repository.ManagedBot, m *Message) {
	token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
	if token == "" {
		return
	}
	tg := telegram.NewBotAPIClient(token)

	raw := strings.TrimSpace(m.Text)
	if raw == "" {
		raw = strings.TrimSpace(m.Caption)
	}

	// Remove bot mention e.g. /gift@iFragmentBot
	parts := strings.Fields(raw)
	if len(parts) == 0 {
		return
	}

	arg := ""
	if len(parts) > 1 {
		arg = strings.Join(parts[1:], " ")
	}

	miniAppURL := h.getMiniAppURL(bot)

	userLang := "en"
	if m.From != nil {
		if dbLang, err := h.db.GetUserLanguage(ctx, m.From.ID); err == nil && dbLang != "" {
			userLang = dbLang
		} else if m.From.LanguageCode != "" {
			userLang = m.From.LanguageCode
		}
	}
	lang := normalizeLang(userLang)

	if arg == "" {
		var helpMsg, btnText string
		switch lang {
		case "fa":
			helpMsg = `🎁 <b>کارشناسی هوشمند گیفت تلگرام (Day-0 Telegram Engine)</b>

برای دریافت ارزیابی دقیق قیمت، کمیابی و هویت بلاکچینی هر گیفت، شناسه یا نام آن را بنویسید:

📌 <b>نمونه دستورات:</b>
• <code>/gift CelestialStar-1</code>
• <code>/gift plush_pepe 42</code>
• <code>/gift DurovsBlackCap-100</code>
• یا ارسال مستقیم لینک: <code>https://t.me/nft/...</code>

💡 <i>همچنین می‌توانید در هر چتی با نوشتن <code>@iFragmentBot gift pepe</code> کارت قیمت را اینلاین بفرستید!</i>`
			btnText = "🚀 ورود به بازار گیفت‌ها در مینی‌اپ"
		case "ru":
			helpMsg = `🎁 <b>Умная оценка подарков Telegram (Day-0 Engine)</b>

Чтобы получить оценку стоимости, анализ редкости атрибутов и он-чейн статус подарка, укажите его название или ссылку:

📌 <b>Примеры команд:</b>
• <code>/gift CelestialStar-1</code>
• <code>/gift plush_pepe 42</code>
• <code>/gift DurovsBlackCap-100</code>
• Или отправьте ссылку: <code>https://t.me/nft/...</code>

💡 <i>Вы также можете написать <code>@iFragmentBot gift pepe</code> в любом чате для инлайн-оценки!</i>`
			btnText = "🚀 Открыть рынок подарков в Mini App"
		case "zh":
			helpMsg = `🎁 <b>Telegram 礼物智能估值 (Day-0 Telegram 引擎)</b>

获取礼物的公允价值、稀缺度基因与链上 TEP-62 身份，请输入其编号或发送链接:

📌 <b>使用示例:</b>
• <code>/gift CelestialStar-1</code>
• <code>/gift plush_pepe 42</code>
• <code>/gift DurovsBlackCap-100</code>
• 或直接发送链接: <code>https://t.me/nft/...</code>

💡 <i>您也可以在任意聊天中输入 <code>@iFragmentBot gift pepe</code> 发送实时估值卡片！</i>`
			btnText = "🚀 在小程序中进入礼物市场"
		default:
			helpMsg = `🎁 <b>Smart Telegram Gift Valuation (Day-0 Engine)</b>

Get fair valuation, trait genetics, and on-chain verified status for any Telegram Gift:

📌 <b>Command Examples:</b>
• <code>/gift CelestialStar-1</code>
• <code>/gift plush_pepe 42</code>
• <code>/gift DurovsBlackCap-100</code>
• Or send a direct link: <code>https://t.me/nft/...</code>

💡 <i>You can also type <code>@iFragmentBot gift pepe</code> in any chat for instant inline valuation!</i>`
			btnText = "🚀 Explore Gifts in Mini App"
		}

		markup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{"text": btnText, "url": miniAppURL + "?startapp=gifts"},
				},
			},
		}
		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, helpMsg, markup, m.MessageThreadID, "HTML")
		return
	}

	sniff := SniffAsset(arg)
	entity := strings.ToLower(strings.TrimSpace(arg))
	if sniff != nil && sniff.Entity != "" {
		entity = sniff.Entity
	} else {
		// Fallback slug normalization: replace spaces with hyphens (e.g. "plush pepe 42" -> "plush_pepe-42" or "pepe 42" -> "pepe-42")
		parts := strings.Fields(entity)
		if len(parts) == 2 {
			entity = fmt.Sprintf("%s-%s", parts[0], parts[1])
		}
	}
	h.sendPreCheckGate(ctx, bot, m.Chat.ID, m.From.ID, "gift", entity, nil, m.MessageThreadID)
}

// handleGiftsCommand processes /gifts - displays Telegram Gifts market pulse
func (h *WebhookHandler) handleGiftsCommand(ctx context.Context, bot *repository.ManagedBot, m *Message) {
	token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
	if token == "" {
		return
	}
	tg := telegram.NewBotAPIClient(token)

	miniAppURL := h.getMiniAppURL(bot)

	userLang := "en"
	if m.From != nil {
		if dbLang, err := h.db.GetUserLanguage(ctx, m.From.ID); err == nil && dbLang != "" {
			userLang = dbLang
		} else if m.From.LanguageCode != "" {
			userLang = m.From.LanguageCode
		}
	}
	lang := normalizeLang(userLang)

	if h.giftsService == nil {
		var loadingMsg string
		switch lang {
		case "fa":
			loadingMsg = "⚠️ بخش خدمات گیفت در حال بارگذاری است."
		case "ru":
			loadingMsg = "⚠️ Сервис подарков загружается."
		case "zh":
			loadingMsg = "⚠️ 礼物服务正在初始化。"
		default:
			loadingMsg = "⚠️ Gift service is currently loading."
		}
		_ = tg.SendMessage(ctx, m.Chat.ID, loadingMsg, &m.MessageID, m.MessageThreadID)
		return
	}

	intel, err := h.giftsService.GetGiftsIntel(ctx)
	if err != nil || intel == nil {
		var errMsg string
		switch lang {
		case "fa":
			errMsg = "⚠️ در حال حاضر امکان دریافت نبض بازار گیفت‌ها وجود ندارد."
		case "ru":
			errMsg = "⚠️ Не удалось получить данные о пульсе рынка подарков."
		case "zh":
			errMsg = "⚠️ 暂无法获取礼物市场脉搏数据。"
		default:
			errMsg = "⚠️ Unable to retrieve gift market pulse right now."
		}
		_ = tg.SendMessage(ctx, m.Chat.ID, errMsg, &m.MessageID, m.MessageThreadID)
		return
	}

	var sb strings.Builder
	var btnMarket string
	switch lang {
	case "fa":
		sb.WriteString("📊 <b>نبض بازار تلگرام گیفت (Market Pulse)</b>\n")
		sb.WriteString(fmt.Sprintf("🔥 <b>شاخص احساسات (F&G):</b> %d/100 (%s)\n\n", intel.FnGIndex, intel.FnGLabel))
		sb.WriteString("━━━━━━━━━━━━━━━━━━━━\n")
		sb.WriteString("💰 <b>آمار کلان و حجم نقدینگی:</b>\n")
		if intel.TotalCumulativeVolumeUSD > 0 {
			sb.WriteString(fmt.Sprintf("• <b>حجم کل معاملات:</b> <code>$%.2fM</code>\n", intel.TotalCumulativeVolumeUSD/1_000_000))
		}
		if intel.TotalMarketCapUSD > 0 {
			sb.WriteString(fmt.Sprintf("• <b>ارزش کل بازار (Market Cap):</b> <code>$%.2fM</code>\n", intel.TotalMarketCapUSD/1_000_000))
		}
		if intel.TotalActiveWallets > 0 {
			sb.WriteString(fmt.Sprintf("• <b>کیف‌پول‌های فعال خریدار/فروشنده:</b> <code>%s</code>\n", formatNumberWithCommas(intel.TotalActiveWallets)))
		}
		if intel.TotalGiftsMinted > 0 {
			sb.WriteString(fmt.Sprintf("• <b>کل گیفت‌های ارتقا یافته:</b> <code>%s</code>\n", formatNumberWithCommas(intel.TotalGiftsMinted)))
		}

		if len(intel.UnifiedFloorBoard) > 0 {
			sb.WriteString("\n🏆 <b>کالکشن‌های برتر (کف قیمت):</b>\n")
			limit := 5
			if len(intel.UnifiedFloorBoard) < limit {
				limit = len(intel.UnifiedFloorBoard)
			}
			for i := 0; i < limit; i++ {
				item := intel.UnifiedFloorBoard[i]
				sb.WriteString(fmt.Sprintf("%d. <b>%s:</b> <code>%.1f TON</code> ($%.0f)\n", i+1, item.Name, item.BestFloorGRAM, item.BestFloorUSD))
			}
		}

		sb.WriteString("\n⚡ <i>داده‌های ۱۰۰٪ نیتیو تلگرام، فرگمنت و گت‌جمز بدون وابستگی به اسکرپر</i>")
		btnMarket = "🚀 مشاهده نقشه ژنتیکی و بازار در مینی‌اپ"

	case "ru":
		sb.WriteString("📊 <b>Пульс рынка подарков Telegram (Market Pulse)</b>\n")
		sb.WriteString(fmt.Sprintf("🔥 <b>Индекс настроений (F&G):</b> %d/100 (%s)\n\n", intel.FnGIndex, intel.FnGLabel))
		sb.WriteString("━━━━━━━━━━━━━━━━━━━━\n")
		sb.WriteString("💰 <b>Макростатистика и ликвидность:</b>\n")
		if intel.TotalCumulativeVolumeUSD > 0 {
			sb.WriteString(fmt.Sprintf("• <b>Совокупный объем торгов:</b> <code>$%.2fM</code>\n", intel.TotalCumulativeVolumeUSD/1_000_000))
		}
		if intel.TotalMarketCapUSD > 0 {
			sb.WriteString(fmt.Sprintf("• <b>Капитализация рынка:</b> <code>$%.2fM</code>\n", intel.TotalMarketCapUSD/1_000_000))
		}
		if intel.TotalActiveWallets > 0 {
			sb.WriteString(fmt.Sprintf("• <b>Активные кошельки:</b> <code>%s</code>\n", formatNumberWithCommas(intel.TotalActiveWallets)))
		}
		if intel.TotalGiftsMinted > 0 {
			sb.WriteString(fmt.Sprintf("• <b>Всего минтингов:</b> <code>%s</code>\n", formatNumberWithCommas(intel.TotalGiftsMinted)))
		}

		if len(intel.UnifiedFloorBoard) > 0 {
			sb.WriteString("\n🏆 <b>Топ коллекций (Floor):</b>\n")
			limit := 5
			if len(intel.UnifiedFloorBoard) < limit {
				limit = len(intel.UnifiedFloorBoard)
			}
			for i := 0; i < limit; i++ {
				item := intel.UnifiedFloorBoard[i]
				sb.WriteString(fmt.Sprintf("%d. <b>%s:</b> <code>%.1f TON</code> ($%.0f)\n", i+1, item.Name, item.BestFloorGRAM, item.BestFloorUSD))
			}
		}

		sb.WriteString("\n⚡ <i>Нативные он-чейн данные Telegram, Fragment и Getgems</i>")
		btnMarket = "🚀 Открыть карту рынка в Mini App"

	case "zh":
		sb.WriteString("📊 <b>Telegram 礼物市场脉搏 (Market Pulse)</b>\n")
		sb.WriteString(fmt.Sprintf("🔥 <b>市场情绪指数 (F&G):</b> %d/100 (%s)\n\n", intel.FnGIndex, intel.FnGLabel))
		sb.WriteString("━━━━━━━━━━━━━━━━━━━━\n")
		sb.WriteString("💰 <b>宏观流动性与交易指标:</b>\n")
		if intel.TotalCumulativeVolumeUSD > 0 {
			sb.WriteString(fmt.Sprintf("• <b>累计成交总额:</b> <code>$%.2fM</code>\n", intel.TotalCumulativeVolumeUSD/1_000_000))
		}
		if intel.TotalMarketCapUSD > 0 {
			sb.WriteString(fmt.Sprintf("• <b>全网总市值:</b> <code>$%.2fM</code>\n", intel.TotalMarketCapUSD/1_000_000))
		}
		if intel.TotalActiveWallets > 0 {
			sb.WriteString(fmt.Sprintf("• <b>活跃交易钱包:</b> <code>%s</code>\n", formatNumberWithCommas(intel.TotalActiveWallets)))
		}
		if intel.TotalGiftsMinted > 0 {
			sb.WriteString(fmt.Sprintf("• <b>铸造/升级总数:</b> <code>%s</code>\n", formatNumberWithCommas(intel.TotalGiftsMinted)))
		}

		if len(intel.UnifiedFloorBoard) > 0 {
			sb.WriteString("\n🏆 <b>热门头部系列 (底价):</b>\n")
			limit := 5
			if len(intel.UnifiedFloorBoard) < limit {
				limit = len(intel.UnifiedFloorBoard)
			}
			for i := 0; i < limit; i++ {
				item := intel.UnifiedFloorBoard[i]
				sb.WriteString(fmt.Sprintf("%d. <b>%s:</b> <code>%.1f TON</code> ($%.0f)\n", i+1, item.Name, item.BestFloorGRAM, item.BestFloorUSD))
			}
		}

		sb.WriteString("\n⚡ <i>基于 Telegram、Fragment 与 Getgems 官方原生聚合数据</i>")
		btnMarket = "🚀 在小程序中探索基因图谱与市场"

	default:
		sb.WriteString("📊 <b>Telegram Gifts Market Pulse</b>\n")
		sb.WriteString(fmt.Sprintf("🔥 <b>Market Sentiment (F&G):</b> %d/100 (%s)\n\n", intel.FnGIndex, intel.FnGLabel))
		sb.WriteString("━━━━━━━━━━━━━━━━━━━━\n")
		sb.WriteString("💰 <b>Macro Volume & Liquidity:</b>\n")
		if intel.TotalCumulativeVolumeUSD > 0 {
			sb.WriteString(fmt.Sprintf("• <b>Cumulative Volume:</b> <code>$%.2fM</code>\n", intel.TotalCumulativeVolumeUSD/1_000_000))
		}
		if intel.TotalMarketCapUSD > 0 {
			sb.WriteString(fmt.Sprintf("• <b>Total Market Cap:</b> <code>$%.2fM</code>\n", intel.TotalMarketCapUSD/1_000_000))
		}
		if intel.TotalActiveWallets > 0 {
			sb.WriteString(fmt.Sprintf("• <b>Active Trader Wallets:</b> <code>%s</code>\n", formatNumberWithCommas(intel.TotalActiveWallets)))
		}
		if intel.TotalGiftsMinted > 0 {
			sb.WriteString(fmt.Sprintf("• <b>Total Minted/Upgraded:</b> <code>%s</code>\n", formatNumberWithCommas(intel.TotalGiftsMinted)))
		}

		if len(intel.UnifiedFloorBoard) > 0 {
			sb.WriteString("\n🏆 <b>Leading Collections (Floor):</b>\n")
			limit := 5
			if len(intel.UnifiedFloorBoard) < limit {
				limit = len(intel.UnifiedFloorBoard)
			}
			for i := 0; i < limit; i++ {
				item := intel.UnifiedFloorBoard[i]
				sb.WriteString(fmt.Sprintf("%d. <b>%s:</b> <code>%.1f TON</code> ($%.0f)\n", i+1, item.Name, item.BestFloorGRAM, item.BestFloorUSD))
			}
		}

		sb.WriteString("\n⚡ <i>Native on-chain data from Telegram, Fragment & Getgems</i>")
		btnMarket = "🚀 Explore Genetic Map & Market in Mini App"
	}

	markup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{"text": btnMarket, "url": miniAppURL + "?startapp=gifts"},
			},
		},
	}

	_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, sb.String(), markup, m.MessageThreadID, "HTML")
}

// handleGiftLinkSniff detects t.me/nft/... or fragment.com/gift/... and routes through precheck credit gate
func (h *WebhookHandler) handleGiftLinkSniff(ctx context.Context, bot *repository.ManagedBot, m *Message, linkRef string) {
	if m.From == nil {
		return
	}
	sniff := SniffAsset(linkRef)
	entity := linkRef
	if sniff != nil && sniff.Entity != "" {
		entity = sniff.Entity
	}
	h.sendPreCheckGate(ctx, bot, m.Chat.ID, m.From.ID, "gift", entity, nil, m.MessageThreadID)
}

// handleInlineQuery handles @iFragmentBot inline searches for gifts
func (h *WebhookHandler) handleInlineQuery(ctx context.Context, bot *repository.ManagedBot, iq *InlineQuery) {
	if iq == nil || h.giftsService == nil {
		return
	}

	token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
	if token == "" {
		return
	}
	tg := telegram.NewBotAPIClient(token)

	query := strings.TrimSpace(iq.Query)
	miniAppURL := os.Getenv("MINI_APP_URL")
	if miniAppURL == "" {
		miniAppURL = "https://t.me/iFragmentBot/iFragment"
	}

	// Remove leading "gift" or "gifts" if typed: e.g. "@iFragmentBot gift pepe"
	if strings.HasPrefix(strings.ToLower(query), "gift ") {
		query = strings.TrimSpace(query[5:])
	}

	var results []interface{}

	// Sniff if the user is asking about a Username, Collectible Number, or Gift
	sniff := SniffAsset(query)
	if sniff != nil {
		switch sniff.Type {
		case "username":
			normUser := strings.TrimPrefix(strings.ToLower(sniff.Entity), "@")
			if h.avmService != nil {
				res, err := h.avmService.Valuate(ctx, normUser, 0)
				if err == nil && res != nil {
					appURL := fmt.Sprintf("%s?startapp=val_%s", miniAppURL, normUser)
					botUsername := bot.BotUsername
					if botUsername == "" {
						botUsername = "iFragmentBot"
					}
					cleanBotUser := strings.TrimPrefix(botUsername, "@")
					botPMURL := fmt.Sprintf("https://t.me/%s?start=val_%s", cleanBotUser, normUser)

					msgText := fmt.Sprintf(`🏷️ <b>پیش‌نمایش کارشناسی نام کاربری: @%s</b>

💎 درجه سرمایه‌گذاری: <b>%s</b>
📈 شاخص برندپذیری: <b>%d / 100</b>
🔒 <i>ارزش منصفانه و برآورد قیمتی قفل است.</i>

⚡ جهت دریافت گزارش کامل و دقیق موتور AVM با اعتبار تحلیلی، ربات را در پیوی باز کنید.`,
						normUser,
						res.InvestmentGrade,
						res.Brandability,
					)

					results = append(results, telegram.InlineQueryResultArticle{
						Type:        "article",
						ID:          fmt.Sprintf("user_%s", normUser),
						Title:       fmt.Sprintf("🏷️ کارشناسی نام کاربری: @%s", normUser),
						Description: fmt.Sprintf("درجه: %s | شاخص برندپذیری: %d/100 | گزارش کامل در پیوی", res.InvestmentGrade, res.Brandability),
						InputMessageContent: map[string]interface{}{
							"message_text": msgText,
							"parse_mode":   "HTML",
						},
						ReplyMarkup: map[string]interface{}{
							"inline_keyboard": [][]map[string]interface{}{
								{
									{"text": "🔓 مشاهده گزارش کامل در پیوی", "url": botPMURL},
									{"text": "📊 مینی‌اپ iFragment", "url": appURL},
								},
							},
						},
					})
				}
			}
		case "number":
			if h.numbersService != nil {
				val, err := h.numbersService.ValuateNumber(ctx, 0, sniff.Entity)
				if err == nil && val != nil {
					cleanNum := strings.TrimPrefix(val.Number, "+")
					appURL := fmt.Sprintf("%s?startapp=num_%s", miniAppURL, cleanNum)
					club := val.CategoryClubFa
					if club == "" {
						club = val.CategoryClub
					}
					botUsername := bot.BotUsername
					if botUsername == "" {
						botUsername = "iFragmentBot"
					}
					cleanBotUser := strings.TrimPrefix(botUsername, "@")
					botPMURL := fmt.Sprintf("https://t.me/%s?start=num_%s", cleanBotUser, cleanNum)

					msgText := fmt.Sprintf(`📱 <b>پیش‌نمایش شماره کلکسیونی: %s</b>

👑 کلوپ: <b>%s</b>
🏆 رتبه کمیابی در شبکه: <b>#%d</b>
🎯 ضریب اطمینان: <b>%d%%</b>
🔒 <i>برآورد قیمت منصفانه (Fair Value) قفل است.</i>

⚡ جهت آزادسازی ارزیابی دقیق موتور NV Engine با اعتبار تحلیلی، دکمه زیر را لمس نمایید.`,
						val.DisplayNumber,
						club,
						val.GlobalRank,
						val.ConfidenceScore,
					)

					results = append(results, telegram.InlineQueryResultArticle{
						Type:        "article",
						ID:          fmt.Sprintf("num_%s", cleanNum),
						Title:       fmt.Sprintf("📱 کارشناسی شماره: %s", val.DisplayNumber),
						Description: fmt.Sprintf("کلوپ: %s | رتبه: #%d | گزارش کامل در پیوی", club, val.GlobalRank),
						InputMessageContent: map[string]interface{}{
							"message_text": msgText,
							"parse_mode":   "HTML",
						},
						ReplyMarkup: map[string]interface{}{
							"inline_keyboard": [][]map[string]interface{}{
								{
									{"text": "🔓 دریافت گزارش کامل در پیوی", "url": botPMURL},
									{"text": "📊 مینی‌اپ iFragment", "url": appURL},
								},
							},
						},
					})
				}
			}
		}
	}

	if (query == "" || strings.EqualFold(query, "gifts")) && len(results) == 0 {
		// Return Market Overview Article
		if h.giftsService != nil {
			intel, err := h.giftsService.GetGiftsIntel(ctx)
			if err == nil && intel != nil {
				marketArticle := telegram.InlineQueryResultArticle{
					Type:        "article",
					ID:          "gifts_market_overview",
					Title:       fmt.Sprintf("📊 نبض بازار گیفت‌ها (F&G: %d/100)", intel.FnGIndex),
					Description: fmt.Sprintf("حجم: $%.1fM | ارزش بازار: $%.1fM | فعال: %d", intel.TotalCumulativeVolumeUSD/1_000_000, intel.TotalMarketCapUSD/1_000_000, intel.TotalActiveWallets),
					InputMessageContent: map[string]interface{}{
						"message_text": fmt.Sprintf("📊 <b>نبض بازار تلگرام گیفت</b>\n🔥 احساسات: <b>%d/100 (%s)</b>\n💰 حجم: <code>$%.2fM</code> | مارکت کپ: <code>$%.2fM</code>\n\n⚡ <a href=\"%s?startapp=gifts\">مشاهده زنده در مینی‌اپ iFragment</a>",
							intel.FnGIndex, intel.FnGLabel, intel.TotalCumulativeVolumeUSD/1_000_000, intel.TotalMarketCapUSD/1_000_000, miniAppURL),
						"parse_mode": "HTML",
					},
					ReplyMarkup: map[string]interface{}{
						"inline_keyboard": [][]map[string]interface{}{
							{{"text": "🚀 باز کردن بازار در مینی‌اپ", "url": miniAppURL + "?startapp=gifts"}},
						},
					},
				}
				results = append(results, marketArticle)

				// Top 4 collections as quick search suggestions
				for idx, item := range intel.UnifiedFloorBoard {
					if idx >= 4 {
						break
					}
					results = append(results, telegram.InlineQueryResultArticle{
						Type:        "article",
						ID:          fmt.Sprintf("col_%s", item.ModelID),
						Title:       fmt.Sprintf("💎 مجموعه %s", item.Name),
						Description: fmt.Sprintf("کف قیمت: %.1f TON ($%.0f) | عرضه: %d", item.BestFloorGRAM, item.BestFloorUSD, item.TotalSupply),
						InputMessageContent: map[string]interface{}{
							"message_text": fmt.Sprintf("💎 <b>مجموعه گیفت %s</b>\n🌊 کف قیمت: <code>%.1f TON</code> ($%.0f)\n📦 کل عرضه: <code>%s</code>\n\n⚡ <a href=\"%s?startapp=gift_%s-1\">مشاهده گزارش تحلیلی در iFragment</a>",
								item.Name, item.BestFloorGRAM, item.BestFloorUSD, formatNumberWithCommas(item.TotalSupply), miniAppURL, item.ModelID),
							"parse_mode": "HTML",
						},
						ReplyMarkup: map[string]interface{}{
							"inline_keyboard": [][]map[string]interface{}{
								{{"text": "📊 تحلیل هوشمند در مینی‌اپ", "url": fmt.Sprintf("%s?startapp=gift_%s-1", miniAppURL, item.ModelID)}},
							},
						},
					})
				}
			}
		}
	} else if len(results) == 0 && h.giftsService != nil {
		// Specific gift query (e.g. "pepe 42" or "CelestialStar-1")
		val, err := h.giftsService.GetBotGiftAppraisal(ctx, query)
		if err == nil && val != nil {
			fairTON := val.Pillars.FairValueGRAM
			floorTON := val.Pillars.ObservedFloorGRAM
			userLang := iq.From.LanguageCode
			msgText, markup := h.formatGiftAppraisalMessage(val, miniAppURL, userLang)

			giftArticle := telegram.InlineQueryResultArticle{
				Type:        "article",
				ID:          fmt.Sprintf("gift_%s", val.GiftID),
				Title:       fmt.Sprintf("🎁 %s", val.DisplayTitle),
				Description: fmt.Sprintf("ارزش منصفانه: %.1f TON | کف قیمت: %.1f TON | شماره: #%d", fairTON, floorTON, val.SerialNumber),
				InputMessageContent: map[string]interface{}{
					"message_text": msgText,
					"parse_mode":   "HTML",
				},
				ReplyMarkup: markup,
			}
			results = append(results, giftArticle)
		}
	}

	var inlineBtn *telegram.InlineQueryResultsButton
	if sniff != nil {
		switch sniff.Type {
		case "username":
			normUser := strings.TrimPrefix(strings.ToLower(sniff.Entity), "@")
			inlineBtn = &telegram.InlineQueryResultsButton{
				Text:           "🔓 دریافت گزارش کامل در پیوی",
				StartParameter: fmt.Sprintf("val_%s", normUser),
			}
		case "number":
			cleanNum := strings.TrimPrefix(sniff.Entity, "+")
			inlineBtn = &telegram.InlineQueryResultsButton{
				Text:           "🔓 دریافت گزارش کامل در پیوی",
				StartParameter: fmt.Sprintf("num_%s", cleanNum),
			}
		}
	}

	_ = tg.AnswerInlineQueryWithButton(ctx, iq.ID, results, 10, false, inlineBtn)
}

// formatGiftAppraisalMessage constructs a rich, beautiful Telegram card for a gift valuation
func (h *WebhookHandler) formatGiftAppraisalMessage(val *gvengine.GiftValuation, miniAppURL string, lang ...string) (string, map[string]interface{}) {
	userLang := "fa"
	if len(lang) > 0 && lang[0] != "" {
		userLang = normalizeLang(lang[0])
	}
	text := buildGiftStandardHTML(val, userLang)
	tonStr := fmt.Sprintf("%.2f", val.Pillars.FairValueGRAM)
	usdStr := fmt.Sprintf("%.2f", val.ExpectedUSD)
	copySummary := buildCopySummary("🎁", val.DisplayTitle, tonStr, usdStr, fmt.Sprintf("Serial: #%d", val.SerialNumber), userLang)
	markup := buildGiftMarkup(val, miniAppURL, copySummary, userLang)
	return text, markup
}

func formatNumberWithCommas(n int) string {
	in := strconv.Itoa(n)
	out := make([]byte, 0, len(in)+len(in)/3)
	j := len(in) % 3
	if j == 0 {
		j = 3
	}
	out = append(out, in[:j]...)
	for i := j; i < len(in); i += 3 {
		out = append(out, ',')
		out = append(out, in[i:i+3]...)
	}
	return string(out)
}
