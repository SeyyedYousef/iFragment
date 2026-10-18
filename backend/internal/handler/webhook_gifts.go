package handler

import (
	"context"
	"encoding/json"
	"fmt"
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

		sb.WriteString("\n⚡ <i>داده‌های ۱۰۰٪ نیتیو تلگرام، فرگمنت، پورتالز، MRKT و api.changes.tg</i>")
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
	cacheKey := fmt.Sprintf("inline:v2:%s:%s", lang, strings.ToLower(query))
	if h.cache != nil && h.cache.Client != nil && !h.cache.IsQuotaExceeded() {
		if cachedJSON, err := h.cache.Client.Get(ctx, cacheKey).Result(); err == nil && cachedJSON != "" {
			var cachedResults []interface{}
			if json.Unmarshal([]byte(cachedJSON), &cachedResults) == nil && len(cachedResults) > 0 {
				_ = tg.AnswerInlineQueryWithButton(ctx, iq.ID, cachedResults, 15, false, h.buildInlineSwitchButton(SniffAsset(query), lang))
				return
			}
		}
	}

	var results []interface{}
	sniff := SniffAsset(query)

	if sniff != nil {
		switch sniff.Type {
		case "username":
			normUser := strings.TrimPrefix(strings.ToLower(sniff.Entity), "@")
			if h.avmService != nil {
				res, err := h.avmService.Valuate(ctx, normUser, 0)
				if err == nil && res != nil {
					appURL := appendStartParam(miniAppURL, fmt.Sprintf("val_%s", normUser))
					colURL := appendStartParam(miniAppURL, "collection_usernames")
					botPMURL := fmt.Sprintf("https://t.me/%s?start=val_%s", botUsername, normUser)
					fragURL := fmt.Sprintf("https://fragment.com/username/%s", normUser)

					var title, desc, msgText, btnUnlockPM, btnApp, btnCol, btnFrag string
					switch lang {
					case "fa":
						title = fmt.Sprintf("🏷️ کارشناسی نام کاربری: @%s", normUser)
						desc = fmt.Sprintf("درجه: %s | برندپذیری: %d/100 | طول: %d کاراکتر", res.InvestmentGrade, res.Brandability, len(normUser))
						msgText = fmt.Sprintf(`🏷️ <b>کارت هوشمند نام کاربری: @%s</b>

<blockquote>💎 <b>درجه سرمایه‌گذاری:</b> <code>%s</code>
📈 <b>شاخص برندپذیری:</b> <code>%d / 100</code>
📏 <b>طول شناسه:</b> <code>%d کاراکتر</code> (استاندارد تلمینت)
🔒 <b>ارزش منصفانه (AVM v7.0):</b> <i>محافظت‌شده در گیت تحلیلی</i></blockquote>

⚡ <i>برای بازگشایی طیف دقیق قیمت (Floor / Fair / Ceiling) و شجره‌نامه آن‌چین، از دکمه‌های شیشه‌ای زیر استفاده کنید:</i>`,
							normUser, res.InvestmentGrade, res.Brandability, len(normUser))
						btnUnlockPM = "🔓 بازگشایی قیمت در ربات"
						btnApp = "📊 تحلیل عمیق در مینی‌اپ"
						btnCol = "🏛️ نبض کالکشن یوزرنیم‌ها"
						btnFrag = "🌐 مشاهده در فرگمنت"
					case "ru":
						title = fmt.Sprintf("🏷️ Оценка юзернейма: @%s", normUser)
						desc = fmt.Sprintf("Грейд: %s | Бренд: %d/100 | Длина: %d симв.", res.InvestmentGrade, res.Brandability, len(normUser))
						msgText = fmt.Sprintf(`🏷️ <b>Интеллектуальная карта юзернейма: @%s</b>

<blockquote>💎 <b>Инвест-грейд:</b> <code>%s</code>
📈 <b>Индекс бренда:</b> <code>%d / 100</code>
📏 <b>Длина:</b> <code>%d симв.</code> (Telemint TEP-62)
🔒 <b>Справедливая цена (AVM v7.0):</b> <i>Доступна в полном отчете</i></blockquote>

⚡ <i>Откройте полный ценовой спектр и он-чейн аудит в боте или Mini App:</i>`,
							normUser, res.InvestmentGrade, res.Brandability, len(normUser))
						btnUnlockPM = "🔓 Открыть цену в боте"
						btnApp = "📊 Анализ в Mini App"
						btnCol = "🏛️ Макро-рынок"
						btnFrag = "🌐 На Fragment"
					case "zh":
						title = fmt.Sprintf("🏷️ 用户名专业评估: @%s", normUser)
						desc = fmt.Sprintf("评级: %s | 品牌分: %d/100 | 长度: %d 字符", res.InvestmentGrade, res.Brandability, len(normUser))
						msgText = fmt.Sprintf(`🏷️ <b>Telegram 用户名智能名片: @%s</b>

<blockquote>💎 <b>投资评级:</b> <code>%s</code>
📈 <b>品牌指数:</b> <code>%d / 100</code>
📏 <b>字符长度:</b> <code>%d 字符</code> (Telemint TEP-62)
🔒 <b>公允估值 (AVM v7.0):</b> <i>深度报告内解锁</i></blockquote>

⚡ <i>点击下方玻璃按钮解锁完整价格区间与链上溯源报告：</i>`,
							normUser, res.InvestmentGrade, res.Brandability, len(normUser))
						btnUnlockPM = "🔓 在机器人中解锁价格"
						btnApp = "📊 小程序深度报告"
						btnCol = "🏛️ 用户名大盘数据"
						btnFrag = "🌐 Fragment 详情"
					default:
						title = fmt.Sprintf("🏷️ Username Intelligence: @%s", normUser)
						desc = fmt.Sprintf("Grade: %s | Brandability: %d/100 | Length: %d chars", res.InvestmentGrade, res.Brandability, len(normUser))
						msgText = fmt.Sprintf(`🏷️ <b>Username Intelligence Card: @%s</b>

<blockquote>💎 <b>Investment Grade:</b> <code>%s</code>
📈 <b>Brandability Score:</b> <code>%d / 100</code>
📏 <b>Handle Length:</b> <code>%d chars</code> (Telemint TEP-62)
🔒 <b>Fair Valuation (AVM v7.0):</b> <i>Protected in Deep Report</i></blockquote>

⚡ <i>Unlock the full valuation band (Floor / Fair / Ceiling) & on-chain provenance via the buttons below:</i>`,
							normUser, res.InvestmentGrade, res.Brandability, len(normUser))
						btnUnlockPM = "🔓 Unlock Price in Bot"
						btnApp = "📊 Deep Dive in Mini App"
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
									{"text": btnUnlockPM, "url": botPMURL},
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
					cleanNum := strings.TrimPrefix(val.Number, "+")
					appURL := appendStartParam(miniAppURL, fmt.Sprintf("num_%s", cleanNum))
					colURL := appendStartParam(miniAppURL, "numbers")
					botPMURL := fmt.Sprintf("https://t.me/%s?start=num_%s", botUsername, cleanNum)
					fragURL := fmt.Sprintf("https://fragment.com/number/%s", cleanNum)
					if val.FragmentDirectURL != "" {
						fragURL = val.FragmentDirectURL
					}

					club := val.CategoryClub
					if lang == "fa" && val.CategoryClubFa != "" {
						club = val.CategoryClubFa
					}

					var title, desc, msgText, btnUnlockPM, btnApp, btnCol, btnFrag string
					switch lang {
					case "fa":
						title = fmt.Sprintf("📱 کارشناسی شماره: %s", val.DisplayNumber)
						desc = fmt.Sprintf("کلوپ: %s | رتبه: #%d | اطمینان: %d%%", club, val.GlobalRank, val.ConfidenceScore)
						msgText = fmt.Sprintf(`📱 <b>کارت هوشمند شماره ناشناس: %s</b>

<blockquote>👑 <b>کلوپ کلکسیونی:</b> <code>%s</code>
🏆 <b>رتبه کمیابی در شبکه:</b> <code>#%d از 136,566</code>
🎯 <b>ضریب اطمینان مدل:</b> <code>%d%%</code>
🔒 <b>ارزش منصفانه (NV Engine):</b> <i>محافظت‌شده در گیت تحلیلی</i></blockquote>

⚡ <i>برای بازگشایی قیمت منصفانه، ارزش وثیقه دیفای و معاملات همتراز، روی دکمه‌های شیشه‌ای زیر کلیک کنید:</i>`,
							val.DisplayNumber, club, val.GlobalRank, val.ConfidenceScore)
						btnUnlockPM = "🔓 بازگشایی قیمت در ربات"
						btnApp = "📊 گزارش عمیق در مینی‌اپ"
						btnCol = "🏛️ دیدبان کلان +888"
						btnFrag = "🌐 مشاهده در فرگمنت"
					case "ru":
						title = fmt.Sprintf("📱 Оценка номера: %s", val.DisplayNumber)
						desc = fmt.Sprintf("Клуб: %s | Ранг: #%d | Доверие: %d%%", club, val.GlobalRank, val.ConfidenceScore)
						msgText = fmt.Sprintf(`📱 <b>Интеллектуальная карта номера: %s</b>

<blockquote>👑 <b>Клуб коллекции:</b> <code>%s</code>
🏆 <b>Ранг редкости:</b> <code>#%d из 136,566</code>
🎯 <b>Индекс доверия:</b> <code>%d%%</code>
🔒 <b>Справедливая оценка (NV Engine):</b> <i>В полном отчете</i></blockquote>

⚡ <i>Откройте полную стоимость, залог DeFi и историю сделок через кнопки ниже:</i>`,
							val.DisplayNumber, club, val.GlobalRank, val.ConfidenceScore)
						btnUnlockPM = "🔓 Открыть цену в боте"
						btnApp = "📊 Отчет в Mini App"
						btnCol = "🏛️ Рынок +888"
						btnFrag = "🌐 На Fragment"
					case "zh":
						title = fmt.Sprintf("📱 匿名靓号评估: %s", val.DisplayNumber)
						desc = fmt.Sprintf("俱乐部: %s | 排名: #%d | 置信度: %d%%", club, val.GlobalRank, val.ConfidenceScore)
						msgText = fmt.Sprintf(`📱 <b>+888 匿名靓号智能名片: %s</b>

<blockquote>👑 <b>归属俱乐部:</b> <code>%s</code>
🏆 <b>全网稀缺排名:</b> <code>#%d / 136,566</code>
🎯 <b>模型置信度:</b> <code>%d%%</code>
🔒 <b>公允价值 (NV Engine):</b> <i>深度报告内解锁</i></blockquote>

⚡ <i>点击下方玻璃按钮解锁公允估值、DeFi 抵押额度与链上成交对标：</i>`,
							val.DisplayNumber, club, val.GlobalRank, val.ConfidenceScore)
						btnUnlockPM = "🔓 在机器人中解锁价格"
						btnApp = "📊 小程序深度报告"
						btnCol = "🏛️ +888 宏观大盘"
						btnFrag = "🌐 Fragment 详情"
					default:
						title = fmt.Sprintf("📱 Number Intelligence: %s", val.DisplayNumber)
						desc = fmt.Sprintf("Club: %s | Rank: #%d | Confidence: %d%%", club, val.GlobalRank, val.ConfidenceScore)
						msgText = fmt.Sprintf(`📱 <b>Anonymous Number Intelligence: %s</b>

<blockquote>👑 <b>Category Club:</b> <code>%s</code>
🏆 <b>Global Rarity Rank:</b> <code>#%d of 136,566</code>
🎯 <b>Model Confidence:</b> <code>%d%%</code>
🔒 <b>Fair Valuation (NV Engine):</b> <i>Protected in Deep Report</i></blockquote>

⚡ <i>Unlock the fair value, DeFi collateral rating, and comparable sales via the buttons below:</i>`,
							val.DisplayNumber, club, val.GlobalRank, val.ConfidenceScore)
						btnUnlockPM = "🔓 Unlock Price in Bot"
						btnApp = "📊 Deep Dive in Mini App"
						btnCol = "🏛️ +888 Macro Market"
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
									{"text": btnUnlockPM, "url": botPMURL},
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
		}
	}

	if (query == "" || strings.EqualFold(query, "gifts")) && len(results) == 0 && h.giftsService != nil {
		intel, err := h.giftsService.GetGiftsIntel(ctx)
		if err == nil && intel != nil {
			var marketTitle, marketDesc, marketMsg, btnOpenApp string
			switch lang {
			case "fa":
				marketTitle = fmt.Sprintf("📊 نبض بازار گیفت‌ها (F&G: %d/100)", intel.FnGIndex)
				marketDesc = fmt.Sprintf("حجم: $%.1fM | ارزش بازار: $%.1fM | فعال: %d", intel.TotalCumulativeVolumeUSD/1_000_000, intel.TotalMarketCapUSD/1_000_000, intel.TotalActiveWallets)
				marketMsg = fmt.Sprintf("📊 <b>نبض بازار تلگرام گیفت (Market Pulse)</b>\n<blockquote>🔥 احساسات بازار: <b>%d/100 (%s)</b>\n💰 حجم کل: <code>$%.2fM</code> | مارکت کپ: <code>$%.2fM</code></blockquote>\n⚡ <a href=\"%s\">مشاهده زنده در مینی‌اپ iFragment</a>",
					intel.FnGIndex, intel.FnGLabel, intel.TotalCumulativeVolumeUSD/1_000_000, intel.TotalMarketCapUSD/1_000_000, appendStartParam(miniAppURL, "gifts"))
				btnOpenApp = "🚀 باز کردن بازار در مینی‌اپ"
			case "ru":
				marketTitle = fmt.Sprintf("📊 Пульс рынка подарков (F&G: %d/100)", intel.FnGIndex)
				marketDesc = fmt.Sprintf("Объем: $%.1fM | Капитализация: $%.1fM | Кошельки: %d", intel.TotalCumulativeVolumeUSD/1_000_000, intel.TotalMarketCapUSD/1_000_000, intel.TotalActiveWallets)
				marketMsg = fmt.Sprintf("📊 <b>Пульс рынка подарков Telegram</b>\n<blockquote>🔥 Настроение: <b>%d/100 (%s)</b>\n💰 Объем: <code>$%.2fM</code> | Капитализация: <code>$%.2fM</code></blockquote>\n⚡ <a href=\"%s\">Открыть в iFragment Mini App</a>",
					intel.FnGIndex, intel.FnGLabel, intel.TotalCumulativeVolumeUSD/1_000_000, intel.TotalMarketCapUSD/1_000_000, appendStartParam(miniAppURL, "gifts"))
				btnOpenApp = "🚀 Открыть рынок в Mini App"
			case "zh":
				marketTitle = fmt.Sprintf("📊 Telegram 礼物市场脉搏 (F&G: %d/100)", intel.FnGIndex)
				marketDesc = fmt.Sprintf("成交额: $%.1fM | 总市值: $%.1fM | 活跃钱包: %d", intel.TotalCumulativeVolumeUSD/1_000_000, intel.TotalMarketCapUSD/1_000_000, intel.TotalActiveWallets)
				marketMsg = fmt.Sprintf("📊 <b>Telegram 礼物市场脉搏</b>\n<blockquote>🔥 情绪指数: <b>%d/100 (%s)</b>\n💰 成交额: <code>$%.2fM</code> | 市值: <code>$%.2fM</code></blockquote>\n⚡ <a href=\"%s\">在 iFragment 小程序中实时查看</a>",
					intel.FnGIndex, intel.FnGLabel, intel.TotalCumulativeVolumeUSD/1_000_000, intel.TotalMarketCapUSD/1_000_000, appendStartParam(miniAppURL, "gifts"))
				btnOpenApp = "🚀 在小程序中打开礼物市场"
			default:
				marketTitle = fmt.Sprintf("📊 Telegram Gifts Market Pulse (F&G: %d/100)", intel.FnGIndex)
				marketDesc = fmt.Sprintf("Volume: $%.1fM | Market Cap: $%.1fM | Active Wallets: %d", intel.TotalCumulativeVolumeUSD/1_000_000, intel.TotalMarketCapUSD/1_000_000, intel.TotalActiveWallets)
				marketMsg = fmt.Sprintf("📊 <b>Telegram Gifts Market Pulse</b>\n<blockquote>🔥 Sentiment: <b>%d/100 (%s)</b>\n💰 Volume: <code>$%.2fM</code> | Market Cap: <code>$%.2fM</code></blockquote>\n⚡ <a href=\"%s\">Explore Live in iFragment Mini App</a>",
					intel.FnGIndex, intel.FnGLabel, intel.TotalCumulativeVolumeUSD/1_000_000, intel.TotalMarketCapUSD/1_000_000, appendStartParam(miniAppURL, "gifts"))
				btnOpenApp = "🚀 Open Market in Mini App"
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
				if idx >= 4 {
					break
				}
				colURL := appendStartParam(miniAppURL, fmt.Sprintf("col_%s", item.ModelID))
				itemURL := appendStartParam(miniAppURL, fmt.Sprintf("gift_%s-1", item.ModelID))
				slugHyphen := strings.ReplaceAll(item.ModelID, "_", "-")
				thumbURL := fmt.Sprintf("https://api.changes.tg/model/%s/Original.png?size=128", slugHyphen)

				var cTitle, cDesc, cMsg, btnColApp, btnItemApp string
				switch lang {
				case "fa":
					cTitle = fmt.Sprintf("💎 کالکشن %s", item.Name)
					cDesc = fmt.Sprintf("کف قیمت: %.1f TON ($%.0f) | عرضه کل: %s", item.BestFloorGRAM, item.BestFloorUSD, formatNumberWithCommas(item.TotalSupply))
					cMsg = fmt.Sprintf("💎 <b>کالکشن گیفت %s</b>\n<blockquote>🌊 کف قیمت لحظه‌ای: <code>%.1f TON</code> (~$%.0f)\n📦 کل عرضه: <code>%s</code> آیتم</blockquote>\n⚡ <i>تحلیل آربیتراژ ۷ مارکت و نقشه حرارتی در مینی‌اپ iFragment:</i>",
						item.Name, item.BestFloorGRAM, item.BestFloorUSD, formatNumberWithCommas(item.TotalSupply))
					btnColApp = "🏛️ تحلیل کالکشن در مینی‌اپ"
					btnItemApp = "🎁 کارشناسی #1"
				case "ru":
					cTitle = fmt.Sprintf("💎 Коллекция %s", item.Name)
					cDesc = fmt.Sprintf("Floor: %.1f TON ($%.0f) | Эмиссия: %s", item.BestFloorGRAM, item.BestFloorUSD, formatNumberWithCommas(item.TotalSupply))
					cMsg = fmt.Sprintf("💎 <b>Коллекция подарков %s</b>\n<blockquote>🌊 Текущий Floor: <code>%.1f TON</code> (~$%.0f)\n📦 Всего выпущено: <code>%s</code></blockquote>\n⚡ <i>Арбитраж по 7 площадкам и тепловая карта редкости в iFragment:</i>",
						item.Name, item.BestFloorGRAM, item.BestFloorUSD, formatNumberWithCommas(item.TotalSupply))
					btnColApp = "🏛️ Анализ коллекции"
					btnItemApp = "🎁 Оценка #1"
				case "zh":
					cTitle = fmt.Sprintf("💎 %s 藏品系列", item.Name)
					cDesc = fmt.Sprintf("底价: %.1f TON ($%.0f) | 发行量: %s", item.BestFloorGRAM, item.BestFloorUSD, formatNumberWithCommas(item.TotalSupply))
					cMsg = fmt.Sprintf("💎 <b>Telegram 礼物系列: %s</b>\n<blockquote>🌊 实时底价: <code>%.1f TON</code> (~$%.0f)\n📦 发行总量: <code>%s</code></blockquote>\n⚡ <i>在 iFragment 小程序中查看 7 大市场套利与稀缺度热力图：</i>",
						item.Name, item.BestFloorGRAM, item.BestFloorUSD, formatNumberWithCommas(item.TotalSupply))
					btnColApp = "🏛️ 系列宏观分析"
					btnItemApp = "🎁 鉴定 #1"
				default:
					cTitle = fmt.Sprintf("💎 %s Collection", item.Name)
					cDesc = fmt.Sprintf("Floor: %.1f TON ($%.0f) | Supply: %s", item.BestFloorGRAM, item.BestFloorUSD, formatNumberWithCommas(item.TotalSupply))
					cMsg = fmt.Sprintf("💎 <b>%s Gift Collection</b>\n<blockquote>🌊 Live Floor: <code>%.1f TON</code> (~$%.0f)\n📦 Total Supply: <code>%s</code></blockquote>\n⚡ <i>7-venue arbitrage radar & trait rarity heatmap in iFragment Mini App:</i>",
						item.Name, item.BestFloorGRAM, item.BestFloorUSD, formatNumberWithCommas(item.TotalSupply))
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
	} else if len(results) == 0 && h.giftsService != nil {
		val, err := h.giftsService.GetBotGiftAppraisal(ctx, query)
		if err == nil && val != nil {
			fairTON := val.Pillars.FairValueGRAM
			floorTON := val.Pillars.ObservedFloorGRAM
			msgText, markup := h.formatGiftAppraisalMessage(val, miniAppURL, lang)

			thumbURL := val.ImageURL
			if thumbURL == "" {
				pascal := telegramnft.FormatPascalName(val.ModelID)
				thumbURL = fmt.Sprintf("https://t.me/i/userpic/320/%s.jpg", pascal)
			}

			var desc string
			switch lang {
			case "fa":
				desc = fmt.Sprintf("ارزش منصفانه: %.1f TON | کف قیمت: %.1f TON | سریال: #%d", fairTON, floorTON, val.SerialNumber)
			case "ru":
				desc = fmt.Sprintf("Справедливая: %.1f TON | Floor: %.1f TON | Серия: #%d", fairTON, floorTON, val.SerialNumber)
			case "zh":
				desc = fmt.Sprintf("公允价值: %.1f TON | 底价: %.1f TON | 编号: #%d", fairTON, floorTON, val.SerialNumber)
			default:
				desc = fmt.Sprintf("Fair Value: %.1f TON | Floor: %.1f TON | Serial: #%d", fairTON, floorTON, val.SerialNumber)
			}

			giftArticle := telegram.InlineQueryResultArticle{
				Type:        "article",
				ID:          fmt.Sprintf("gift_%s", val.GiftID),
				Title:       fmt.Sprintf("🎁 %s", val.DisplayTitle),
				Description: desc,
				ThumbURL:    thumbURL,
				InputMessageContent: map[string]interface{}{
					"message_text": msgText,
					"parse_mode":   "HTML",
				},
				ReplyMarkup: markup,
			}
			results = append(results, giftArticle)
		}
	}

	// Cache non-empty inline results for 45 seconds
	if len(results) > 0 && h.cache != nil && h.cache.Client != nil && !h.cache.IsQuotaExceeded() {
		if data, err := json.Marshal(results); err == nil {
			_ = h.cache.Client.Set(ctx, cacheKey, string(data), 45*time.Second).Err()
		}
	}

	inlineBtn := h.buildInlineSwitchButton(sniff, lang)
	_ = tg.AnswerInlineQueryWithButton(ctx, iq.ID, results, 15, false, inlineBtn)
}

func (h *WebhookHandler) buildInlineSwitchButton(sniff *SmartSniffResult, lang string) *telegram.InlineQueryResultsButton {
	if sniff == nil {
		return nil
	}
	var label string
	switch normalizeLang(lang) {
	case "fa":
		label = "🔓 دریافت گزارش کامل در پیوی"
	case "ru":
		label = "🔓 Открыть полный отчет в боте"
	case "zh":
		label = "🔓 在机器人中获取完整报告"
	default:
		label = "🔓 Unlock Full Report in Bot"
	}

	switch sniff.Type {
	case "username":
		normUser := strings.TrimPrefix(strings.ToLower(sniff.Entity), "@")
		return &telegram.InlineQueryResultsButton{
			Text:           label,
			StartParameter: fmt.Sprintf("val_%s", normUser),
		}
	case "number":
		cleanNum := strings.TrimPrefix(sniff.Entity, "+")
		return &telegram.InlineQueryResultsButton{
			Text:           label,
			StartParameter: fmt.Sprintf("num_%s", cleanNum),
		}
	case "gift":
		return &telegram.InlineQueryResultsButton{
			Text:           label,
			StartParameter: fmt.Sprintf("gift_%s", sniff.Entity),
		}
	}
	return nil
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
