package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/gifts/gvengine"
	"ifragment-backend/internal/service/gifts/telegramnft"
)

var giftLinkRegex = regexp.MustCompile(`(?i)(?:https?://)?(?:t\.me/nft/|fragment\.com/gift/)([a-zA-Z0-9_\-]+)`)

// handleGiftCommand processes /gift [id/name] [serial]
func (h *WebhookHandler) handleGiftCommand(ctx context.Context, bot *repository.ManagedBot, m *Message) {
	tg := h.getBotClient(bot)
	if tg == nil {
		return
	}

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
		if h.db != nil {
			if dbLang, err := h.db.GetUserLanguage(ctx, m.From.ID); err == nil && dbLang != "" {
				userLang = dbLang
			} else if m.From.LanguageCode != "" {
				userLang = m.From.LanguageCode
			}
		} else if m.From.LanguageCode != "" {
			userLang = m.From.LanguageCode
		}
	}
	lang := normalizeLang(userLang)

	if arg == "" {
		var helpMsg, btnText, btnMacro string
		switch lang {
		case "fa":
			helpMsg = `🎁 <b>کارشناسی هوشمند گیفت تلگرام (Day-0 Telegram Engine)</b>

<blockquote>برای دریافت ارزیابی دقیق قیمت، کمیابی و هویت بلاکچینی هر گیفت، شناسه یا نام آن را بنویسید:</blockquote>

📌 <b>نمونه دستورات:</b>
• <code>/gift CelestialStar-1</code>
• <code>/gift plush_pepe 42</code>
• <code>/gift DurovsBlackCap-100</code>
• یا ارسال مستقیم لینک: <code>https://t.me/nft/...</code>

💡 <i>همچنین می‌توانید در هر چتی با نوشتن <code>@iFragmentBot PlushPepe-42</code> کارت ارزیابی را اینلاین به اشتراک بگذارید!</i>`
			btnText = "🚀 ورود به بازار گیفت‌ها در مینی‌اپ"
			btnMacro = "📊 نبض بازار گیفت‌ها (/gifts)"
		case "ru":
			helpMsg = `🎁 <b>Умная оценка подарков Telegram (Day-0 Engine)</b>

<blockquote>Чтобы получить оценку стоимости, анализ редкости атрибутов и он-чейн статус подарка, укажите его название или ссылку:</blockquote>

📌 <b>Примеры команд:</b>
• <code>/gift CelestialStar-1</code>
• <code>/gift plush_pepe 42</code>
• <code>/gift DurovsBlackCap-100</code>
• Или отправьте ссылку: <code>https://t.me/nft/...</code>

💡 <i>Вы также можете написать <code>@iFragmentBot PlushPepe-42</code> в любом чате для инлайн-оценки!</i>`
			btnText = "🚀 Открыть рынок подарков в Mini App"
			btnMacro = "📊 Пульс рынка (/gifts)"
		case "zh":
			helpMsg = `🎁 <b>Telegram 礼物智能估值 (Day-0 Telegram 引擎)</b>

<blockquote>获取礼物的公允价值、稀缺度基因与链上 TEP-62 身份，请输入其编号或发送链接:</blockquote>

📌 <b>使用示例:</b>
• <code>/gift CelestialStar-1</code>
• <code>/gift plush_pepe 42</code>
• <code>/gift DurovsBlackCap-100</code>
• 或直接发送链接: <code>https://t.me/nft/...</code>

💡 <i>您也可以在任意聊天中输入 <code>@iFragmentBot PlushPepe-42</code> 发送实时估值卡片！</i>`
			btnText = "🚀 在小程序中进入礼物市场"
			btnMacro = "📊 市场宏观脉搏 (/gifts)"
		default:
			helpMsg = `🎁 <b>Smart Telegram Gift Valuation (Day-0 Engine)</b>

<blockquote>Get fair valuation, trait genetics, and on-chain verified status for any Telegram Gift:</blockquote>

📌 <b>Command Examples:</b>
• <code>/gift CelestialStar-1</code>
• <code>/gift plush_pepe 42</code>
• <code>/gift DurovsBlackCap-100</code>
• Or send a direct link: <code>https://t.me/nft/...</code>

💡 <i>You can also type <code>@iFragmentBot PlushPepe-42</code> in any chat for instant inline valuation!</i>`
			btnText = "🚀 Explore Gifts in Mini App"
			btnMacro = "📊 Market Macro Pulse (/gifts)"
		}

		markup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{"text": btnText, "url": appendStartParam(miniAppURL, "gifts")},
				},
				{
					{"text": btnMacro, "callback_data": "nav:asset_gifts"},
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
		parts := strings.Fields(entity)
		if len(parts) == 2 {
			entity = fmt.Sprintf("%s-%s", parts[0], parts[1])
		}
	}
	h.sendPreCheckGate(ctx, bot, m.Chat.ID, m.From.ID, "gift", entity, nil, m.MessageThreadID)
}

// handleGiftsCommand processes /gifts - displays Telegram Gifts market pulse
func (h *WebhookHandler) handleGiftsCommand(ctx context.Context, bot *repository.ManagedBot, m *Message) {
	tg := h.getBotClient(bot)
	if tg == nil {
		return
	}

	miniAppURL := h.getMiniAppURL(bot)

	userLang := "en"
	if m.From != nil {
		if h.db != nil {
			if dbLang, err := h.db.GetUserLanguage(ctx, m.From.ID); err == nil && dbLang != "" {
				userLang = dbLang
			} else if m.From.LanguageCode != "" {
				userLang = m.From.LanguageCode
			}
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
	var btnMarket, btnShare string
	switch lang {
	case "fa":
		sb.WriteString("📊 <b>نبض بازار تلگرام گیفت (Market Pulse)</b>\n")
		sb.WriteString(fmt.Sprintf("🔥 <b>شاخص احساسات (F&G):</b> <code>%d/100</code> (%s)\n\n", intel.FnGIndex, intel.FnGLabel))
		sb.WriteString("<blockquote>💰 <b>آمار کلان و حجم نقدینگی:</b>\n")
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
			sb.WriteString(fmt.Sprintf("• <b>کل گیفت‌های ارتقا یافته:</b> <code>%s</code>", formatNumberWithCommas(intel.TotalGiftsMinted)))
		}
		sb.WriteString("</blockquote>\n")

		if len(intel.UnifiedFloorBoard) > 0 {
			sb.WriteString("\n<blockquote expandable>🏆 <b>کالکشن‌های برتر (کف قیمت):</b>\n")
			limit := 5
			if len(intel.UnifiedFloorBoard) < limit {
				limit = len(intel.UnifiedFloorBoard)
			}
			for i := 0; i < limit; i++ {
				item := intel.UnifiedFloorBoard[i]
				sb.WriteString(fmt.Sprintf("%d. <b>%s:</b> <code>%.1f TON</code> ($%.0f)\n", i+1, item.Name, item.BestFloorGRAM, item.BestFloorUSD))
			}
			sb.WriteString("</blockquote>\n")
		}

		sb.WriteString("\n⚡ <i>داده‌های 100% نیتیو تلگرام، فرگمنت، پورتالز، MRKT و api.changes.tg</i>")
		btnMarket = "🚀 مشاهده نقشه ژنتیکی و بازار در مینی‌اپ"
		btnShare = "📤 اشتراک‌گذاری نبض بازار"

	case "ru":
		sb.WriteString("📊 <b>Пульс рынка подарков Telegram (Market Pulse)</b>\n")
		sb.WriteString(fmt.Sprintf("🔥 <b>Индекс настроений (F&G):</b> <code>%d/100</code> (%s)\n\n", intel.FnGIndex, intel.FnGLabel))
		sb.WriteString("<blockquote>💰 <b>Макростатистика и ликвидность:</b>\n")
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
			sb.WriteString(fmt.Sprintf("• <b>Всего минтингов:</b> <code>%s</code>", formatNumberWithCommas(intel.TotalGiftsMinted)))
		}
		sb.WriteString("</blockquote>\n")

		if len(intel.UnifiedFloorBoard) > 0 {
			sb.WriteString("\n<blockquote expandable>🏆 <b>Топ коллекций (Floor):</b>\n")
			limit := 5
			if len(intel.UnifiedFloorBoard) < limit {
				limit = len(intel.UnifiedFloorBoard)
			}
			for i := 0; i < limit; i++ {
				item := intel.UnifiedFloorBoard[i]
				sb.WriteString(fmt.Sprintf("%d. <b>%s:</b> <code>%.1f TON</code> ($%.0f)\n", i+1, item.Name, item.BestFloorGRAM, item.BestFloorUSD))
			}
			sb.WriteString("</blockquote>\n")
		}

		sb.WriteString("\n⚡ <i>Нативные он-чейн данные Telegram, Fragment, Portals, MRKT и api.changes.tg</i>")
		btnMarket = "🚀 Открыть карту рынка в Mini App"
		btnShare = "📤 Поделиться пульсом рынка"

	case "zh":
		sb.WriteString("📊 <b>Telegram 礼物市场脉搏 (Market Pulse)</b>\n")
		sb.WriteString(fmt.Sprintf("🔥 <b>市场情绪指数 (F&G):</b> <code>%d/100</code> (%s)\n\n", intel.FnGIndex, intel.FnGLabel))
		sb.WriteString("<blockquote>💰 <b>宏观流动性与交易指标:</b>\n")
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
			sb.WriteString(fmt.Sprintf("• <b>铸造/升级总数:</b> <code>%s</code>", formatNumberWithCommas(intel.TotalGiftsMinted)))
		}
		sb.WriteString("</blockquote>\n")

		if len(intel.UnifiedFloorBoard) > 0 {
			sb.WriteString("\n<blockquote expandable>🏆 <b>热门头部系列 (底价):</b>\n")
			limit := 5
			if len(intel.UnifiedFloorBoard) < limit {
				limit = len(intel.UnifiedFloorBoard)
			}
			for i := 0; i < limit; i++ {
				item := intel.UnifiedFloorBoard[i]
				sb.WriteString(fmt.Sprintf("%d. <b>%s:</b> <code>%.1f TON</code> ($%.0f)\n", i+1, item.Name, item.BestFloorGRAM, item.BestFloorUSD))
			}
			sb.WriteString("</blockquote>\n")
		}

		sb.WriteString("\n⚡ <i>基于 Telegram、Fragment、Portals、MRKT 与 api.changes.tg 原生聚合数据</i>")
		btnMarket = "🚀 在小程序中探索基因图谱与市场"
		btnShare = "📤 分享市场脉搏"

	default:
		sb.WriteString("📊 <b>Telegram Gifts Market Pulse</b>\n")
		sb.WriteString(fmt.Sprintf("🔥 <b>Market Sentiment (F&G):</b> <code>%d/100</code> (%s)\n\n", intel.FnGIndex, intel.FnGLabel))
		sb.WriteString("<blockquote>💰 <b>Macro Volume & Liquidity:</b>\n")
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
			sb.WriteString(fmt.Sprintf("• <b>Total Minted/Upgraded:</b> <code>%s</code>", formatNumberWithCommas(intel.TotalGiftsMinted)))
		}
		sb.WriteString("</blockquote>\n")

		if len(intel.UnifiedFloorBoard) > 0 {
			sb.WriteString("\n<blockquote expandable>🏆 <b>Leading Collections (Floor):</b>\n")
			limit := 5
			if len(intel.UnifiedFloorBoard) < limit {
				limit = len(intel.UnifiedFloorBoard)
			}
			for i := 0; i < limit; i++ {
				item := intel.UnifiedFloorBoard[i]
				sb.WriteString(fmt.Sprintf("%d. <b>%s:</b> <code>%.1f TON</code> ($%.0f)\n", i+1, item.Name, item.BestFloorGRAM, item.BestFloorUSD))
			}
			sb.WriteString("</blockquote>\n")
		}

		sb.WriteString("\n⚡ <i>Native on-chain data from Telegram, Fragment, Portals, MRKT & api.changes.tg</i>")
		btnMarket = "🚀 Explore Genetic Map & Market in Mini App"
		btnShare = "📤 Share Market Pulse"
	}

	markup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{"text": btnMarket, "url": appendStartParam(miniAppURL, "gifts")},
			},
			{
				{"text": btnShare, "switch_inline_query": "gifts"},
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

// handleInlineQuery handles @iFragmentBot inline queries across Usernames, +888 Numbers, and Telegram Gifts
func (h *WebhookHandler) handleInlineQuery(ctx context.Context, bot *repository.ManagedBot, iq *InlineQuery) {
	if iq == nil {
		return
	}

	tg := h.getBotClient(bot)
	if tg == nil {
		return
	}

	query := strings.TrimSpace(iq.Query)
	miniAppURL := h.getMiniAppURL(bot)
	lang := normalizeLang(iq.From.LanguageCode)
	if h.db != nil && iq.From.ID > 0 {
		if dbLang, err := h.db.GetUserLanguage(ctx, iq.From.ID); err == nil && dbLang != "" {
			lang = normalizeLang(dbLang)
		}
	}

	// Remove leading "gift " if typed: e.g. "@iFragmentBot gift pepe"
	if strings.HasPrefix(strings.ToLower(query), "gift ") {
		query = strings.TrimSpace(query[5:])
	}

	botUsername := "iFragmentBot"
	if bot != nil && bot.BotUsername != "" {
		botUsername = strings.TrimPrefix(bot.BotUsername, "@")
	}

	// Fast Redis/DragonflyDB cache lookup for inline results (<10ms response)
	cacheKey := fmt.Sprintf("inline:v3:%s:%s", lang, strings.ToLower(query))
	if h.cache != nil && h.cache.Client != nil && !h.cache.IsQuotaExceeded() {
		if cachedJSON, err := h.cache.Client.Get(ctx, cacheKey).Result(); err == nil && cachedJSON != "" {
			var cachedResults []interface{}
			if json.Unmarshal([]byte(cachedJSON), &cachedResults) == nil && len(cachedResults) > 0 {
				_ = tg.AnswerInlineQueryWithButton(ctx, iq.ID, cachedResults, 15, false, h.buildInlineSwitchButton(SniffAsset(query), miniAppURL, lang))
				return
			}
		}
	}

	var results []interface{}
	sniff := SniffAsset(query)

	tonRate := h.resolveLiveTONRate(ctx)
	_ = botUsername

	if sniff != nil {
		switch sniff.Type {
		case "username":
			normUser := strings.TrimPrefix(strings.ToLower(sniff.Entity), "@")
			if h.avmService != nil {
				res, err := h.avmService.Valuate(ctx, normUser, tonRate)
				if err == nil && res != nil {
					ensureUsernameUSD(res, tonRate)
					appURL := appendStartParam(miniAppURL, fmt.Sprintf("val_%s", normUser))
					colURL := appendStartParam(miniAppURL, "collection_usernames")
					fragURL := fmt.Sprintf("https://fragment.com/username/%s", normUser)

					rarityTier := res.Rarity.Tier
					if rarityTier == "" {
						rarityTier = "Common"
					}
					tonStr := res.ExpectedTON.StringFixed(1)
					usdStr := res.ExpectedUSD.StringFixed(0)
					escUser := telegram.EscapeHTML(normUser)
					escRarity := telegram.EscapeHTML(strings.ToUpper(rarityTier))
					escGrade := telegram.EscapeHTML(res.InvestmentGrade)

					var title, desc, msgText, btnApp, btnCol, btnFrag string
					switch lang {
					case "fa":
						title = fmt.Sprintf("✦ @%s — ~%s TON (≈ $%s)", normUser, tonStr, usdStr)
						desc = fmt.Sprintf("کمیابی: %s | درجه: %s | برندپذیری: %d/100 | باز کردن در مینی‌اپ", strings.ToUpper(rarityTier), res.InvestmentGrade, res.Brandability)
						msgText = fmt.Sprintf(`✦ <b>گواهی هوشمند نام کاربری  ·  @%s</b> ✦

<blockquote>💎 <b>سطح کمیابی:</b> <code>%s</code>  ·  <b>درجه:</b> <b>%s</b>
💰 <b>ارزش منصفانه بازار:</b> <b>~%s TON</b> (<code>≈ $%s</code>)
📈 <b>شاخص برندپذیری:</b> <code>%d/100</code>  ·  <b>طول:</b> <code>%d کاراکتر</code></blockquote>

🚀 <i>گزارش کامل 10 فصلی، معاملات همتراز و نمودار زنده در مینی‌اپ iFragment:</i>`,
							escUser, escRarity, escGrade, tonStr, usdStr, res.Brandability, len(normUser))
						btnApp = "💎 تحلیل کامل در وب‌اپلیکیشن iFragment"
						btnCol = "🏛️ نبض بازار یوزرنیم‌ها"
						btnFrag = "🌐 مشاهده در فرگمنت"
					case "ru":
						title = fmt.Sprintf("✦ @%s — ~%s TON (≈ $%s)", normUser, tonStr, usdStr)
						desc = fmt.Sprintf("Редкость: %s | Грейд: %s | Бренд: %d/100 | Открыть в Mini App", strings.ToUpper(rarityTier), res.InvestmentGrade, res.Brandability)
						msgText = fmt.Sprintf(`✦ <b>Сертификат юзернейма  ·  @%s</b> ✦

<blockquote>💎 <b>Редкость:</b> <code>%s</code>  ·  <b>Грейд:</b> <b>%s</b>
💰 <b>Справедливая цена:</b> <b>~%s TON</b> (<code>≈ $%s</code>)
📈 <b>Индекс бренда:</b> <code>%d/100</code>  ·  <b>Длина:</b> <code>%d симв.</code></blockquote>

🚀 <i>Полный разбор, аналоги и живые графики в iFragment Mini App:</i>`,
							escUser, escRarity, escGrade, tonStr, usdStr, res.Brandability, len(normUser))
						btnApp = "💎 Открыть полный анализ в Mini App"
						btnCol = "🏛️ Макро-рынок"
						btnFrag = "🌐 На Fragment"
					case "zh":
						title = fmt.Sprintf("✦ @%s — ~%s TON (≈ $%s)", normUser, tonStr, usdStr)
						desc = fmt.Sprintf("稀有度: %s | 评级: %s | 品牌分: %d/100 | 在小程序中查看", strings.ToUpper(rarityTier), res.InvestmentGrade, res.Brandability)
						msgText = fmt.Sprintf(`✦ <b>Telegram 用户名估值证书  ·  @%s</b> ✦

<blockquote>💎 <b>稀有度:</b> <code>%s</code>  ·  <b>评级:</b> <b>%s</b>
💰 <b>预估公允价值:</b> <b>~%s TON</b> (<code>≈ $%s</code>)
📈 <b>品牌指数:</b> <code>%d/100</code>  ·  <b>长度:</b> <code>%d 字符</code></blockquote>

🚀 <i>点击下方按钮直接在 iFragment 小程序中查看 10 维深度报告：</i>`,
							escUser, escRarity, escGrade, tonStr, usdStr, res.Brandability, len(normUser))
						btnApp = "💎 在 iFragment 小程序查看完整报告"
						btnCol = "🏛️ 用户名大盘数据"
						btnFrag = "🌐 Fragment 详情"
					default:
						title = fmt.Sprintf("✦ @%s — ~%s TON (≈ $%s)", normUser, tonStr, usdStr)
						desc = fmt.Sprintf("Rarity: %s | Grade: %s | Brand: %d/100 | Open in Mini App", strings.ToUpper(rarityTier), res.InvestmentGrade, res.Brandability)
						msgText = fmt.Sprintf(`✦ <b>Username Valuation Certificate  ·  @%s</b> ✦

<blockquote>💎 <b>Rarity Tier:</b> <code>%s</code>  ·  <b>Grade:</b> <b>%s</b>
💰 <b>Estimated Fair Value:</b> <b>~%s TON</b> (<code>≈ $%s</code>)
📈 <b>Brandability:</b> <code>%d/100</code>  ·  <b>Length:</b> <code>%d chars</code></blockquote>

🚀 <i>Inspect full 10-module analytics, live comps & charts in iFragment Mini App:</i>`,
							escUser, escRarity, escGrade, tonStr, usdStr, res.Brandability, len(normUser))
						btnApp = "💎 Open Full Report in Mini App"
						btnCol = "🏛️ Collection Macro"
						btnFrag = "🌐 View on Fragment"
					}

					results = append(results, telegram.InlineQueryResultArticle{
						Type:        "article",
						ID:          fmt.Sprintf("user_%s", normUser),
						Title:       title,
						Description: desc,
						InputMessageContent: map[string]interface{}{
							"message_text": msgText,
							"parse_mode":   "HTML",
						},
						ReplyMarkup: map[string]interface{}{
							"inline_keyboard": [][]map[string]interface{}{
								{
									{"text": btnApp, "url": appURL},
								},
								{
									{"text": btnCol, "url": colURL},
									{"text": btnFrag, "url": fragURL},
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
					if val.ExpectedUSD <= 0 && val.ExpectedTON.IsPositive() {
						val.ExpectedUSD = val.ExpectedTON.InexactFloat64() * tonRate
					}
					cleanNum := strings.TrimPrefix(val.Number, "+")
					appURL := appendStartParam(miniAppURL, fmt.Sprintf("num_%s", cleanNum))
					colURL := appendStartParam(miniAppURL, "numbers")
					fragURL := fmt.Sprintf("https://fragment.com/number/%s", cleanNum)
					if val.FragmentDirectURL != "" {
						fragURL = val.FragmentDirectURL
					}

					club := val.CategoryClub
					if lang == "fa" && val.CategoryClubFa != "" {
						club = val.CategoryClubFa
					}
					tonStr := val.ExpectedTON.StringFixed(1)
					usdStr := fmt.Sprintf("%.0f", val.ExpectedUSD)
					escNum := telegram.EscapeHTML(val.DisplayNumber)
					escClub := telegram.EscapeHTML(club)

					var title, desc, msgText, btnApp, btnCol, btnFrag string
					switch lang {
					case "fa":
						title = fmt.Sprintf("✦ %s — ~%s TON (≈ $%s)", val.DisplayNumber, tonStr, usdStr)
						desc = fmt.Sprintf("کلوپ: %s | رتبه جهانی: #%d از 136,566 | باز کردن در مینی‌اپ", club, val.GlobalRank)
						msgText = fmt.Sprintf(`✦ <b>گواهی هوشمند شماره کلکسیونی  ·  %s</b> ✦

<blockquote>👑 <b>کلوپ کلکسیونی:</b> <code>%s</code>
💰 <b>ارزش منصفانه بازار:</b> <b>~%s TON</b> (<code>≈ $%s</code>)
🏆 <b>رتبه کمیابی جهانی:</b> <code>#%d از 136,566</code>  ·  <b>اطمینان:</b> <code>%d%%</code></blockquote>

🚀 <i>تحلیل هندسه الگو، نمودار زنده +888 و ارزش وثیقه دیفای در مینی‌اپ iFragment:</i>`,
							escNum, escClub, tonStr, usdStr, val.GlobalRank, val.ConfidenceScore)
						btnApp = "💎 گزارش عمیق شماره در وب‌اپلیکیشن"
						btnCol = "📈 نمودار و بازار +888"
						btnFrag = "🌐 مشاهده در فرگمنت"
					case "ru":
						title = fmt.Sprintf("✦ %s — ~%s TON (≈ $%s)", val.DisplayNumber, tonStr, usdStr)
						desc = fmt.Sprintf("Клуб: %s | Ранг: #%d | Доверие: %d%% | Открыть в Mini App", club, val.GlobalRank, val.ConfidenceScore)
						msgText = fmt.Sprintf(`✦ <b>Сертификат анонимного номера  ·  %s</b> ✦

<blockquote>👑 <b>Клуб коллекции:</b> <code>%s</code>
💰 <b>Справедливая оценка:</b> <b>~%s TON</b> (<code>≈ $%s</code>)
🏆 <b>Ранг редкости:</b> <code>#%d из 136,566</code>  ·  <b>Доверие:</b> <code>%d%%</code></blockquote>

🚀 <i>Графики, геометрия паттерна и DeFi-оценка в iFragment Mini App:</i>`,
							escNum, escClub, tonStr, usdStr, val.GlobalRank, val.ConfidenceScore)
						btnApp = "💎 Открыть отчёт в Mini App"
						btnCol = "📈 График и рынок +888"
						btnFrag = "🌐 На Fragment"
					case "zh":
						title = fmt.Sprintf("✦ %s — ~%s TON (≈ $%s)", val.DisplayNumber, tonStr, usdStr)
						desc = fmt.Sprintf("俱乐部: %s | 排名: #%d | 置信度: %d%% | 在小程序中查看", club, val.GlobalRank, val.ConfidenceScore)
						msgText = fmt.Sprintf(`✦ <b>+888 匿名靓号估值证书  ·  %s</b> ✦

<blockquote>👑 <b>归属俱乐部:</b> <code>%s</code>
💰 <b>预估公允价值:</b> <b>~%s TON</b> (<code>≈ $%s</code>)
🏆 <b>全网排名:</b> <code>#%d / 136,566</code>  ·  <b>置信度:</b> <code>%d%%</code></blockquote>

🚀 <i>在 iFragment 小程序中查看实时图表、DeFi 授信与链上成交对标：</i>`,
							escNum, escClub, tonStr, usdStr, val.GlobalRank, val.ConfidenceScore)
						btnApp = "💎 在小程序查看深度报告"
						btnCol = "📈 +888 行情图表"
						btnFrag = "🌐 Fragment 详情"
					default:
						title = fmt.Sprintf("✦ %s — ~%s TON (≈ $%s)", val.DisplayNumber, tonStr, usdStr)
						desc = fmt.Sprintf("Club: %s | Rank: #%d | Confidence: %d%% | Open in Mini App", club, val.GlobalRank, val.ConfidenceScore)
						msgText = fmt.Sprintf(`✦ <b>Anonymous Number Certificate  ·  %s</b> ✦

<blockquote>👑 <b>Category Club:</b> <code>%s</code>
💰 <b>Estimated Fair Value:</b> <b>~%s TON</b> (<code>≈ $%s</code>)
🏆 <b>Global Rarity Rank:</b> <code>#%d of 136,566</code>  ·  <b>Confidence:</b> <code>%d%%</code></blockquote>

🚀 <i>Explore live charts, DeFi collateral rating & comparable sales in iFragment Mini App:</i>`,
							escNum, escClub, tonStr, usdStr, val.GlobalRank, val.ConfidenceScore)
						btnApp = "💎 Open Full Report in Mini App"
						btnCol = "📈 +888 Live Chart"
						btnFrag = "🌐 View on Fragment"
					}

					results = append(results, telegram.InlineQueryResultArticle{
						Type:        "article",
						ID:          fmt.Sprintf("num_%s", cleanNum),
						Title:       title,
						Description: desc,
						InputMessageContent: map[string]interface{}{
							"message_text": msgText,
							"parse_mode":   "HTML",
						},
						ReplyMarkup: map[string]interface{}{
							"inline_keyboard": [][]map[string]interface{}{
								{
									{"text": btnApp, "url": appURL},
								},
								{
									{"text": btnCol, "url": colURL},
									{"text": btnFrag, "url": fragURL},
								},
							},
						},
					})
				}
			}
		case "gift":
			if h.giftsService != nil {
				val, err := h.giftsService.GetBotGiftAppraisal(ctx, sniff.Entity)
				if err == nil && val != nil {
					if val.ExpectedUSD <= 0 && val.Pillars.FairValueGRAM > 0 {
						val.ExpectedUSD = val.Pillars.FairValueGRAM * tonRate
					}
					results = append(results, h.buildInlineGiftArticle(val, miniAppURL, lang))
				}
			}
		}
	}

	// Empty query or browsing: Showcase Mini App Launchers + Live Market Hubs
	if (query == "" || strings.EqualFold(query, "gifts") || strings.EqualFold(query, "app") || strings.EqualFold(query, "market")) && len(results) == 0 {
		results = append(results, h.buildInlineMiniAppShowcase(ctx, miniAppURL, lang)...)
	} else if len(results) == 0 && h.giftsService != nil {
		val, err := h.giftsService.GetBotGiftAppraisal(ctx, query)
		if err == nil && val != nil {
			if val.ExpectedUSD <= 0 && val.Pillars.FairValueGRAM > 0 {
				val.ExpectedUSD = val.Pillars.FairValueGRAM * tonRate
			}
			results = append(results, h.buildInlineGiftArticle(val, miniAppURL, lang))
		}
	}

	// Cache non-empty inline results for 45 seconds
	if len(results) > 0 && h.cache != nil && h.cache.Client != nil && !h.cache.IsQuotaExceeded() {
		if data, err := json.Marshal(results); err == nil {
			_ = h.cache.Client.Set(ctx, cacheKey, string(data), 45*time.Second).Err()
		}
	}

	inlineBtn := h.buildInlineSwitchButton(sniff, miniAppURL, lang)
	_ = tg.AnswerInlineQueryWithButton(ctx, iq.ID, results, 15, false, inlineBtn)
}

func (h *WebhookHandler) buildInlineGiftArticle(val *gvengine.GiftValuation, miniAppURL, lang string) telegram.InlineQueryResultArticle {
	fairTON := val.Pillars.FairValueGRAM
	floorTON := val.Pillars.ObservedFloorGRAM
	appGiftURL := appendStartParam(miniAppURL, fmt.Sprintf("gift_%s-%d", val.ModelID, val.SerialNumber))
	appColURL := appendStartParam(miniAppURL, fmt.Sprintf("col_%s", val.ModelID))
	pascal := telegramnft.FormatPascalName(val.ModelID)
	fragURL := fmt.Sprintf("https://fragment.com/gift/%s-%d", strings.ToLower(pascal), val.SerialNumber)

	thumbURL := val.ImageURL
	if thumbURL == "" {
		thumbURL = fmt.Sprintf("https://t.me/i/userpic/320/%s.jpg", pascal)
	}
	rarityTier := formatLocalizedRarityTier(val.JointRarity.RarityClass, lang)
	escTitle := telegram.EscapeHTML(val.DisplayTitle)
	escRarity := telegram.EscapeHTML(rarityTier)

	var desc, msgText, btnApp, btnCol, btnFrag string
	switch lang {
	case "fa":
		desc = fmt.Sprintf("ارزش منصفانه: %.1f TON ($%.0f) | کف: %.1f TON | سریال: #%d", fairTON, val.ExpectedUSD, floorTON, val.SerialNumber)
		msgText = fmt.Sprintf(`✦ <b>گواهی هوشمند گیفت کلکسیونی  ·  %s</b> ✦

<blockquote>💎 <b>رده کمیابی:</b> <code>%s</code>  ·  <b>سریال:</b> <code>#%d</code>
💰 <b>ارزش منصفانه:</b> <b>~%.1f TON</b> (<code>≈ $%.0f</code>)
🌊 <b>کف بازار (Floor):</b> <code>%.1f TON</code></blockquote>

🚀 <i>کالبدشکافی ژنتیک 4 رنگ و مقایسه زنده 6 مارکت در وب‌اپلیکیشن iFragment:</i>`,
			escTitle, escRarity, val.SerialNumber, fairTON, val.ExpectedUSD, floorTON)
		btnApp = "💎 تحلیل کامل گیفت در وب‌اپلیکیشن"
		btnCol = "🏛️ کف قیمت کالکشن"
		btnFrag = "🌐 مشاهده در فرگمنت"
	case "ru":
		desc = fmt.Sprintf("Справедливая: %.1f TON ($%.0f) | Floor: %.1f TON | Серия: #%d", fairTON, val.ExpectedUSD, floorTON, val.SerialNumber)
		msgText = fmt.Sprintf(`✦ <b>Сертификат подарка Telegram  ·  %s</b> ✦

<blockquote>💎 <b>Редкость:</b> <code>%s</code>  ·  <b>Серия:</b> <code>#%d</code>
💰 <b>Справедливая цена:</b> <b>~%.1f TON</b> (<code>≈ $%.0f</code>)
🌊 <b>Рыночный Floor:</b> <code>%.1f TON</code></blockquote>

🚀 <i>Генетика 4-Hex и арбитраж 6 площадок в iFragment Mini App:</i>`,
			escTitle, escRarity, val.SerialNumber, fairTON, val.ExpectedUSD, floorTON)
		btnApp = "💎 Открыть отчёт в Mini App"
		btnCol = "🏛️ Коллекция и Floor"
		btnFrag = "🌐 На Fragment"
	case "zh":
		desc = fmt.Sprintf("公允价值: %.1f TON ($%.0f) | 底价: %.1f TON | 编号: #%d", fairTON, val.ExpectedUSD, floorTON, val.SerialNumber)
		msgText = fmt.Sprintf(`✦ <b>Telegram 典藏礼物估值证书  ·  %s</b> ✦

<blockquote>💎 <b>稀有度:</b> <code>%s</code>  ·  <b>编号:</b> <code>#%d</code>
💰 <b>预估公允价值:</b> <b>~%.1f TON</b> (<code>≈ $%.0f</code>)
🌊 <b>市场地板价:</b> <code>%.1f TON</code></blockquote>

🚀 <i>在 iFragment 小程序中查看四色基因与 6 大市场套利：</i>`,
			escTitle, escRarity, val.SerialNumber, fairTON, val.ExpectedUSD, floorTON)
		btnApp = "💎 在小程序查看深度报告"
		btnCol = "🏛️ 藏品系列大盘"
		btnFrag = "🌐 Fragment 详情"
	default:
		desc = fmt.Sprintf("Fair Value: %.1f TON ($%.0f) | Floor: %.1f TON | Serial: #%d", fairTON, val.ExpectedUSD, floorTON, val.SerialNumber)
		msgText = fmt.Sprintf(`✦ <b>Telegram Gift Valuation  ·  %s</b> ✦

<blockquote>💎 <b>Rarity Tier:</b> <code>%s</code>  ·  <b>Serial:</b> <code>#%d</code>
💰 <b>Estimated Fair Value:</b> <b>~%.1f TON</b> (<code>≈ $%.0f</code>)
🌊 <b>Observed Floor:</b> <code>%.1f TON</code></blockquote>

🚀 <i>Inspect 4-Hex trait DNA & 6-venue arbitrage radar in iFragment Mini App:</i>`,
			escTitle, escRarity, val.SerialNumber, fairTON, val.ExpectedUSD, floorTON)
		btnApp = "💎 Open Full Report in Mini App"
		btnCol = "🏛️ Collection Floor"
		btnFrag = "🌐 View on Fragment"
	}

	return telegram.InlineQueryResultArticle{
		Type:        "article",
		ID:          fmt.Sprintf("gift_%s", val.GiftID),
		Title:       fmt.Sprintf("✦ 🎁 %s — ~%.1f TON", val.DisplayTitle, fairTON),
		Description: desc,
		ThumbURL:    thumbURL,
		InputMessageContent: map[string]interface{}{
			"message_text": msgText,
			"parse_mode":   "HTML",
		},
		ReplyMarkup: map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{"text": btnApp, "url": appGiftURL},
				},
				{
					{"text": btnCol, "url": appColURL},
					{"text": btnFrag, "url": fragURL},
				},
			},
		},
	}
}

func (h *WebhookHandler) buildInlineMiniAppShowcase(ctx context.Context, miniAppURL, lang string) []interface{} {
	var results []interface{}

	// 1. Primary All-in-One Mini App Terminal Card
	var appTitle, appDesc, appMsg, appBtn string
	var uTitle, uDesc, uMsg, uBtn string
	var nTitle, nDesc, nMsg, nBtn string
	switch lang {
	case "fa":
		appTitle = "💎 وب‌اپلیکیشن هوشمند iFragment"
		appDesc = "ارزیابی آنی یوزرنیم، شماره +888 و 122 کالکشن گیفت تلگرام روی شبکه TON"
		appMsg = "✦ <b>iFragment  ·  وب‌اپلیکیشن هوشمند ارزیابی دارایی‌های تلگرام</b> ✦\n\n<blockquote>🏷️ <b>یوزرنیم‌های کلکسیونی</b> · ارزش‌گذاری AVM و نبض بازار\n📱 <b>شماره‌های ناشناس +888</b> · نمودار زنده، رتبه و ارزش دیفای\n🎁 <b>گیفت‌های NFT تلگرام</b> · 122 کالکشن زنده و آربیتراژ 6 مارکت</blockquote>\n\n🚀 <i>برای ورود مستقیم به ترمینال تحلیلی روی دکمه زیر بزنید:</i>"
		appBtn = "💎 ورود به وب‌اپلیکیشن iFragment"

		uTitle = "🏷️ بازار و تحلیل کلان یوزرنیم‌ها"
		uDesc = "شاخص کف قیمت، معاملات زنده، نهنگ‌ها و دسته‌بندی رده‌های یوزرنیم در مینی‌اپ"
		uMsg = "🏷️ <b>ترمینال بازار یوزرنیم‌های کلکسیونی (@username)</b>\n\n<blockquote>📊 نمودار زنده حجم و میانه فروش 7 روزه، ماتریس رده‌ها و ردیاب نهنگ‌های TON</blockquote>\n🚀 <i>مشاهده مستقیم در مینی‌اپ iFragment:</i>"
		uBtn = "🏷️ باز کردن بازار یوزرنیم در مینی‌اپ"

		nTitle = "📱 نمودار زنده و بازار شماره‌های +888"
		nDesc = "نمودار قیمت کف، کلوپ‌های کمیابی و جستجوی هوشمند 136,566 شماره کلکسیونی"
		nMsg = "📱 <b>ترمینال بازار شماره‌های کلکسیونی (+888)</b>\n\n<blockquote>📈 نمودار زنده کف قیمت، رتبه‌بندی جهانی 136,566 شماره و ارزش وثیقه دیفای</blockquote>\n🚀 <i>مشاهده مستقیم در مینی‌اپ iFragment:</i>"
		nBtn = "📱 باز کردن نمودار +888 در مینی‌اپ"
	case "ru":
		appTitle = "💎 Веб-приложение iFragment Mini App"
		appDesc = "Мгновенная оценка юзернеймов, номеров +888 и 122 коллекций подарков в TON"
		appMsg = "✦ <b>iFragment  ·  Терминал оценки активов Telegram</b> ✦\n\n<blockquote>🏷️ <b>Юзернеймы</b> · оценка AVM и пульс рынка\n📱 <b>Номера +888</b> · живые графики, ранг и DeFi\n🎁 <b>Подарки NFT</b> · 122 коллекции и арбитраж 6 маркетов</blockquote>\n\n🚀 <i>Откройте интерактивный терминал кнопкой ниже:</i>"
		appBtn = "💎 Открыть iFragment Mini App"

		uTitle = "🏷️ Макро-рынок юзернеймов"
		uDesc = "Живые графики, уровни редкости и трекер китов TON в Mini App"
		uMsg = "🏷️ <b>Аналитика рынка юзернеймов Telegram (@username)</b>\n\n<blockquote>📊 Живые объемы, медианные сделки и матрица тиров в iFragment Mini App</blockquote>"
		uBtn = "🏷️ Открыть рынок юзернеймов"

		nTitle = "📱 График и рынок номеров +888"
		nDesc = "Живой график Floor, клубы редкости и аналитика 136,566 номеров"
		nMsg = "📱 <b>Аналитика анонимных номеров Telegram (+888)</b>\n\n<blockquote>📈 Живой график Floor, мировой рейтинг 136,566 номеров и DeFi-залог</blockquote>"
		nBtn = "📱 Открыть график +888 в Mini App"
	case "zh":
		appTitle = "💎 iFragment 智能估值小程序"
		appDesc = "一键评估 Telegram 用户名、+888 匿名靓号及 122 个官方礼物系列"
		appMsg = "✦ <b>iFragment  ·  Telegram 链上资产评估终端</b> ✦\n\n<blockquote>🏷️ <b>典藏用户名</b> · AVM 公允估值与市场脉搏\n📱 <b>+888 匿名靓号</b> · 实时走势图表与全网排名\n🎁 <b>电报礼物 NFT</b> · 122 系列地板价与 6 大市场套利</blockquote>\n\n🚀 <i>点击下方按钮直达 iFragment 小程序：</i>"
		appBtn = "💎 启动 iFragment 小程序"

		uTitle = "🏷️ 用户名大盘与层级分析"
		uDesc = "实时成交量、地板价矩阵与 TON 巨鲸追踪"
		uMsg = "🏷️ <b>Telegram 典藏用户名大盘终端 (@username)</b>\n\n<blockquote>📊 7 日成交中枢、长度层级地板价与巨鲸动态监控</blockquote>"
		uBtn = "🏷️ 在小程序查看用户名大盘"

		nTitle = "📱 +888 匿名靓号实时图表"
		nDesc = "实时地板价走势图、稀有度俱乐部与 136,566 靓号检索"
		nMsg = "📱 <b>Telegram +888 匿名靓号市场终端</b>\n\n<blockquote>📈 实时地板价图表、136,566 全网稀缺排名与 DeFi 抵押估值</blockquote>"
		nBtn = "📱 在小程序查看 +888 图表"
	default:
		appTitle = "💎 Launch iFragment Mini App Terminal"
		appDesc = "Instant on-chain valuation for Usernames, +888 Numbers & 122 Gift Collections"
		appMsg = "✦ <b>iFragment  ·  On-Chain Telegram Asset Terminal</b> ✦\n\n<blockquote>🏷️ <b>Collectible Usernames</b> · AVM fair value & market pulse\n📱 <b>Anonymous +888 Numbers</b> · Live price charts, rank & DeFi\n🎁 <b>Telegram NFT Gifts</b> · 122 live collections & 6-venue arbitrage</blockquote>\n\n🚀 <i>Tap below to launch the interactive iFragment Mini App:</i>"
		appBtn = "💎 Open iFragment Mini App"

		uTitle = "🏷️ Usernames Market & Analytics"
		uDesc = "Live 7d volume, length tier floors, undervalued auctions & whale tracker"
		uMsg = "🏷️ <b>Telegram Usernames Collection Terminal (@username)</b>\n\n<blockquote>📊 Live 7d volume, median sale chart, length-tier floors & whale tracker</blockquote>"
		uBtn = "🏷️ Open Usernames Market"

		nTitle = "📱 +888 Numbers Live Chart & Intel"
		nDesc = "Live floor chart, rarity clubs & 136,566 anonymous numbers explorer"
		nMsg = "📱 <b>Anonymous +888 Numbers Market Terminal</b>\n\n<blockquote>📈 Live floor chart, global rarity rank across 136,566 numbers & DeFi intel</blockquote>"
		nBtn = "📱 Open +888 Chart in Mini App"
	}

	results = append(results,
		telegram.InlineQueryResultArticle{
			Type:        "article",
			ID:          "ifragment_mini_app_home",
			Title:       appTitle,
			Description: appDesc,
			InputMessageContent: map[string]interface{}{
				"message_text": appMsg,
				"parse_mode":   "HTML",
			},
			ReplyMarkup: map[string]interface{}{
				"inline_keyboard": [][]map[string]interface{}{
					{{"text": appBtn, "url": miniAppURL}},
				},
			},
		},
		telegram.InlineQueryResultArticle{
			Type:        "article",
			ID:          "ifragment_usernames_market",
			Title:       uTitle,
			Description: uDesc,
			InputMessageContent: map[string]interface{}{
				"message_text": uMsg,
				"parse_mode":   "HTML",
			},
			ReplyMarkup: map[string]interface{}{
				"inline_keyboard": [][]map[string]interface{}{
					{{"text": uBtn, "url": appendStartParam(miniAppURL, "collection_usernames")}},
				},
			},
		},
		telegram.InlineQueryResultArticle{
			Type:        "article",
			ID:          "ifragment_numbers_market",
			Title:       nTitle,
			Description: nDesc,
			InputMessageContent: map[string]interface{}{
				"message_text": nMsg,
				"parse_mode":   "HTML",
			},
			ReplyMarkup: map[string]interface{}{
				"inline_keyboard": [][]map[string]interface{}{
					{{"text": nBtn, "url": appendStartParam(miniAppURL, "numbers")}},
				},
			},
		},
	)

	// 2. Live Telegram Gifts Market Pulse + Top 3 Floor Collections
	if h.giftsService != nil {
		intel, err := h.giftsService.GetGiftsIntel(ctx)
		if err == nil && intel != nil {
			var marketTitle, marketDesc, marketMsg, btnOpenApp string
			escFnG := telegram.EscapeHTML(intel.FnGLabel)
			switch lang {
			case "fa":
				marketTitle = fmt.Sprintf("🎁 نبض بازار گیفت‌ها (F&G: %d/100)", intel.FnGIndex)
				marketDesc = fmt.Sprintf("حجم: $%.1fM | ارزش بازار: $%.1fM | 122 کالکشن زنده در مینی‌اپ", intel.TotalCumulativeVolumeUSD/1_000_000, intel.TotalMarketCapUSD/1_000_000)
				marketMsg = fmt.Sprintf("🎁 <b>نبض بازار گیفت‌های تلگرام (Market Pulse)</b>\n<blockquote>🔥 احساسات بازار: <b>%d/100 (%s)</b>\n💰 حجم کل: <code>$%.2fM</code> | مارکت کپ: <code>$%.2fM</code></blockquote>\n🚀 <i>مشاهده زنده 122 کالکشن در مینی‌اپ iFragment:</i>",
					intel.FnGIndex, escFnG, intel.TotalCumulativeVolumeUSD/1_000_000, intel.TotalMarketCapUSD/1_000_000)
				btnOpenApp = "🎁 باز کردن بازار گیفت در مینی‌اپ"
			case "ru":
				marketTitle = fmt.Sprintf("🎁 Пульс рынка подарков (F&G: %d/100)", intel.FnGIndex)
				marketDesc = fmt.Sprintf("Объем: $%.1fM | Капитализация: $%.1fM | 122 коллекции в Mini App", intel.TotalCumulativeVolumeUSD/1_000_000, intel.TotalMarketCapUSD/1_000_000)
				marketMsg = fmt.Sprintf("🎁 <b>Пульс рынка подарков Telegram</b>\n<blockquote>🔥 Настроение: <b>%d/100 (%s)</b>\n💰 Объем: <code>$%.2fM</code> | Капитализация: <code>$%.2fM</code></blockquote>\n🚀 <i>Открыть 122 коллекции в iFragment Mini App:</i>",
					intel.FnGIndex, escFnG, intel.TotalCumulativeVolumeUSD/1_000_000, intel.TotalMarketCapUSD/1_000_000)
				btnOpenApp = "🎁 Открыть рынок подарков в Mini App"
			case "zh":
				marketTitle = fmt.Sprintf("🎁 礼物市场脉搏 (F&G: %d/100)", intel.FnGIndex)
				marketDesc = fmt.Sprintf("成交额: $%.1fM | 总市值: $%.1fM | 122 个实时系列", intel.TotalCumulativeVolumeUSD/1_000_000, intel.TotalMarketCapUSD/1_000_000)
				marketMsg = fmt.Sprintf("🎁 <b>Telegram 礼物市场脉搏</b>\n<blockquote>🔥 情绪指数: <b>%d/100 (%s)</b>\n💰 成交额: <code>$%.2fM</code> | 市值: <code>$%.2fM</code></blockquote>\n🚀 <i>在 iFragment 小程序中实时查看 122 个系列：</i>",
					intel.FnGIndex, escFnG, intel.TotalCumulativeVolumeUSD/1_000_000, intel.TotalMarketCapUSD/1_000_000)
				btnOpenApp = "🎁 在小程序中打开礼物市场"
			default:
				marketTitle = fmt.Sprintf("🎁 Gifts Market Pulse (F&G: %d/100)", intel.FnGIndex)
				marketDesc = fmt.Sprintf("Volume: $%.1fM | Market Cap: $%.1fM | 122 Live Collections", intel.TotalCumulativeVolumeUSD/1_000_000, intel.TotalMarketCapUSD/1_000_000)
				marketMsg = fmt.Sprintf("🎁 <b>Telegram Gifts Market Pulse</b>\n<blockquote>🔥 Sentiment: <b>%d/100 (%s)</b>\n💰 Volume: <code>$%.2fM</code> | Market Cap: <code>$%.2fM</code></blockquote>\n🚀 <i>Explore 122 live collections in iFragment Mini App:</i>",
					intel.FnGIndex, escFnG, intel.TotalCumulativeVolumeUSD/1_000_000, intel.TotalMarketCapUSD/1_000_000)
				btnOpenApp = "🎁 Open Gifts Market in Mini App"
			}

			results = append(results, telegram.InlineQueryResultArticle{
				Type:        "article",
				ID:          "gifts_market_overview",
				Title:       marketTitle,
				Description: marketDesc,
				InputMessageContent: map[string]interface{}{
					"message_text": marketMsg,
					"parse_mode":   "HTML",
				},
				ReplyMarkup: map[string]interface{}{
					"inline_keyboard": [][]map[string]interface{}{
						{{"text": btnOpenApp, "url": appendStartParam(miniAppURL, "gifts")}},
					},
				},
			})

			for idx, item := range intel.UnifiedFloorBoard {
				if idx >= 3 {
					break
				}
				colURL := appendStartParam(miniAppURL, fmt.Sprintf("col_%s", item.ModelID))
				itemURL := appendStartParam(miniAppURL, fmt.Sprintf("gift_%s-1", item.ModelID))
				slugHyphen := strings.ReplaceAll(item.ModelID, "_", "-")
				thumbURL := fmt.Sprintf("https://api.changes.tg/model/%s/Original.png?size=128", slugHyphen)
				escName := telegram.EscapeHTML(item.Name)

				var cTitle, cDesc, cMsg, btnColApp, btnItemApp string
				switch lang {
				case "fa":
					cTitle = fmt.Sprintf("💎 کالکشن %s — %.1f TON", item.Name, item.BestFloorGRAM)
					cDesc = fmt.Sprintf("کف قیمت: %.1f TON ($%.0f) | عرضه کل: %s", item.BestFloorGRAM, item.BestFloorUSD, formatNumberWithCommas(item.TotalSupply))
					cMsg = fmt.Sprintf("💎 <b>کالکشن گیفت %s</b>\n<blockquote>🌊 کف قیمت لحظه‌ای: <code>%.1f TON</code> (~$%.0f)\n📦 کل عرضه: <code>%s</code> آیتم</blockquote>\n🚀 <i>تحلیل آربیتراژ 7 مارکت و نقشه حرارتی در مینی‌اپ iFragment:</i>",
						escName, item.BestFloorGRAM, item.BestFloorUSD, formatNumberWithCommas(item.TotalSupply))
					btnColApp = "🏛️ تحلیل کالکشن در مینی‌اپ"
					btnItemApp = "🎁 کارشناسی #1"
				case "ru":
					cTitle = fmt.Sprintf("💎 Коллекция %s — %.1f TON", item.Name, item.BestFloorGRAM)
					cDesc = fmt.Sprintf("Floor: %.1f TON ($%.0f) | Эмиссия: %s", item.BestFloorGRAM, item.BestFloorUSD, formatNumberWithCommas(item.TotalSupply))
					cMsg = fmt.Sprintf("💎 <b>Коллекция подарков %s</b>\n<blockquote>🌊 Текущий Floor: <code>%.1f TON</code> (~$%.0f)\n📦 Всего выпущено: <code>%s</code></blockquote>\n🚀 <i>Арбитраж и тепловая карта редкости в iFragment Mini App:</i>",
						escName, item.BestFloorGRAM, item.BestFloorUSD, formatNumberWithCommas(item.TotalSupply))
					btnColApp = "🏛️ Анализ коллекции"
					btnItemApp = "🎁 Оценка #1"
				case "zh":
					cTitle = fmt.Sprintf("💎 %s 系列 — %.1f TON", item.Name, item.BestFloorGRAM)
					cDesc = fmt.Sprintf("底价: %.1f TON ($%.0f) | 发行量: %s", item.BestFloorGRAM, item.BestFloorUSD, formatNumberWithCommas(item.TotalSupply))
					cMsg = fmt.Sprintf("💎 <b>Telegram 礼物系列: %s</b>\n<blockquote>🌊 实时底价: <code>%.1f TON</code> (~$%.0f)\n📦 发行总量: <code>%s</code></blockquote>\n🚀 <i>在 iFragment 小程序中查看 7 大市场套利与稀缺热力图：</i>",
						escName, item.BestFloorGRAM, item.BestFloorUSD, formatNumberWithCommas(item.TotalSupply))
					btnColApp = "🏛️ 系列宏观分析"
					btnItemApp = "🎁 鉴定 #1"
				default:
					cTitle = fmt.Sprintf("💎 %s Collection — %.1f TON", item.Name, item.BestFloorGRAM)
					cDesc = fmt.Sprintf("Floor: %.1f TON ($%.0f) | Supply: %s", item.BestFloorGRAM, item.BestFloorUSD, formatNumberWithCommas(item.TotalSupply))
					cMsg = fmt.Sprintf("💎 <b>%s Gift Collection</b>\n<blockquote>🌊 Live Floor: <code>%.1f TON</code> (~$%.0f)\n📦 Total Supply: <code>%s</code></blockquote>\n🚀 <i>7-venue arbitrage radar & trait rarity heatmap in iFragment Mini App:</i>",
						escName, item.BestFloorGRAM, item.BestFloorUSD, formatNumberWithCommas(item.TotalSupply))
					btnColApp = "🏛️ Collection Analytics"
					btnItemApp = "🎁 Appraise #1"
				}

				results = append(results, telegram.InlineQueryResultArticle{
					Type:        "article",
					ID:          fmt.Sprintf("col_%s", item.ModelID),
					Title:       cTitle,
					Description: cDesc,
					ThumbURL:    thumbURL,
					InputMessageContent: map[string]interface{}{
						"message_text": cMsg,
						"parse_mode":   "HTML",
					},
					ReplyMarkup: map[string]interface{}{
						"inline_keyboard": [][]map[string]interface{}{
							{
								{"text": btnColApp, "url": colURL},
								{"text": btnItemApp, "url": itemURL},
							},
						},
					},
				})
			}
		}
	}

	return results
}

func resolveInlineWebAppBaseURL(miniAppURL string) string {
	if direct := strings.TrimSpace(os.Getenv("WEBAPP_URL")); strings.HasPrefix(direct, "https://") && !strings.Contains(direct, "t.me/") {
		return direct
	}
	if strings.HasPrefix(miniAppURL, "https://") && !strings.Contains(miniAppURL, "t.me/") {
		return miniAppURL
	}
	return "https://seyyedyousef.github.io/iFragment/"
}

func appendWebAppStartParam(baseURL, param string) string {
	if param == "" {
		return baseURL
	}
	if strings.Contains(baseURL, "?") {
		return fmt.Sprintf("%s&tgWebAppStartParam=%s", baseURL, param)
	}
	return fmt.Sprintf("%s?tgWebAppStartParam=%s", baseURL, param)
}

func (h *WebhookHandler) buildInlineSwitchButton(sniff *SmartSniffResult, miniAppURL string, lang string) *telegram.InlineQueryResultsButton {
	baseWebApp := resolveInlineWebAppBaseURL(miniAppURL)
	var label string
	var startParam string

	if sniff == nil {
		switch normalizeLang(lang) {
		case "fa":
			label = "💎 ورود مستقیم به وب‌اپلیکیشن iFragment"
		case "ru":
			label = "💎 Открыть веб-приложение iFragment"
		case "zh":
			label = "💎 立即打开 iFragment 小程序"
		default:
			label = "💎 Launch iFragment Mini App"
		}
		return &telegram.InlineQueryResultsButton{
			Text:   label,
			WebApp: &telegram.WebAppInfo{URL: baseWebApp},
		}
	}

	switch sniff.Type {
	case "username":
		normUser := strings.TrimPrefix(strings.ToLower(sniff.Entity), "@")
		startParam = fmt.Sprintf("val_%s", normUser)
		switch normalizeLang(lang) {
		case "fa":
			label = fmt.Sprintf("💎 تحلیل کامل @%s در مینی‌اپ", normUser)
		case "ru":
			label = fmt.Sprintf("💎 Открыть @%s в Mini App", normUser)
		case "zh":
			label = fmt.Sprintf("💎 在小程序查看 @%s", normUser)
		default:
			label = fmt.Sprintf("💎 Open @%s in Mini App", normUser)
		}
	case "number":
		cleanNum := strings.TrimPrefix(sniff.Entity, "+")
		startParam = fmt.Sprintf("num_%s", cleanNum)
		switch normalizeLang(lang) {
		case "fa":
			label = "💎 تحلیل کامل شماره در مینی‌اپ"
		case "ru":
			label = "💎 Открыть номер в Mini App"
		case "zh":
			label = "💎 在小程序查看靓号报告"
		default:
			label = "💎 Open Number in Mini App"
		}
	case "gift":
		startParam = fmt.Sprintf("gift_%s", sniff.Entity)
		switch normalizeLang(lang) {
		case "fa":
			label = "🎁 تحلیل کامل گیفت در مینی‌اپ"
		case "ru":
			label = "🎁 Открыть подарок в Mini App"
		case "zh":
			label = "🎁 在小程序查看礼物报告"
		default:
			label = "🎁 Open Gift in Mini App"
		}
	default:
		switch normalizeLang(lang) {
		case "fa":
			label = "💎 ورود به وب‌اپلیکیشن iFragment"
		case "ru":
			label = "💎 Открыть iFragment Mini App"
		case "zh":
			label = "💎 打开 iFragment 小程序"
		default:
			label = "💎 Open iFragment Mini App"
		}
	}

	return &telegram.InlineQueryResultsButton{
		Text:   label,
		WebApp: &telegram.WebAppInfo{URL: appendWebAppStartParam(baseWebApp, startParam)},
	}
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
