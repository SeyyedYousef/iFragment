package handler

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"regexp"
	"strconv"
	"strings"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/crypto"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/gifts/gvengine"
	"ifragment-backend/internal/service/gifts/telegramnft"
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

	miniAppURL := os.Getenv("MINI_APP_URL")
	if miniAppURL == "" {
		miniAppURL = "https://t.me/iFragmentBot/iFragment"
	}

	if arg == "" {
		helpMsg := `🎁 <b>کارشناسی هوشمند گیفت تلگرام (Day-0 Telegram Engine)</b>

برای دریافت ارزیابی دقیق قیمت، کمیابی و هویت بلاکچینی هر گیفت، شناسه یا نام آن را بنویسید:

📌 <b>نمونه دستورات:</b>
• <code>/gift CelestialStar-1</code>
• <code>/gift plush_pepe 42</code>
• <code>/gift DurovsBlackCap-100</code>
• یا ارسال مستقیم لینک: <code>https://t.me/nft/...</code>

💡 <i>همچنین می‌توانید در هر چتی با نوشتن <code>@iFragmentBot gift pepe</code> کارت قیمت را اینلاین بفرستید!</i>`

		markup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{"text": "🚀 ورود به بازار گیفت‌ها در مینی‌اپ", "url": miniAppURL + "?startapp=gifts"},
				},
			},
		}
		_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, helpMsg, markup, m.MessageThreadID, "HTML")
		return
	}

	if h.giftsService == nil {
		_ = tg.SendMessage(ctx, m.Chat.ID, "⚠️ بخش خدمات گیفت در حال راه‌اندازی است، لطفا چند لحظه دیگر تلاش کنید.", &m.MessageID, m.MessageThreadID)
		return
	}

	val, err := h.giftsService.GetBotGiftAppraisal(ctx, arg)
	if err != nil {
		slog.Warn("Gift appraisal failed", "query", arg, "err", err)
		errMsg := fmt.Sprintf("❌ گیفت مورد نظر یافت نشد یا فرمت نامعتبر است: <code>%s</code>\nلطفاً نام مجموعه و شماره را درست وارد کنید (مثال: <code>CelestialStar-1</code>)", telegram.EscapeHTML(arg))
		_ = tg.SendMessage(ctx, m.Chat.ID, errMsg, &m.MessageID, m.MessageThreadID)
		return
	}

	msgText, markup := h.formatGiftAppraisalMessage(val, miniAppURL)
	_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, msgText, markup, m.MessageThreadID, "HTML")
}

// handleGiftsCommand processes /gifts - displays Telegram Gifts market pulse
func (h *WebhookHandler) handleGiftsCommand(ctx context.Context, bot *repository.ManagedBot, m *Message) {
	token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
	if token == "" {
		return
	}
	tg := telegram.NewBotAPIClient(token)

	miniAppURL := os.Getenv("MINI_APP_URL")
	if miniAppURL == "" {
		miniAppURL = "https://t.me/iFragmentBot/iFragment"
	}

	if h.giftsService == nil {
		_ = tg.SendMessage(ctx, m.Chat.ID, "⚠️ بخش خدمات گیفت در حال بارگذاری است.", &m.MessageID, m.MessageThreadID)
		return
	}

	intel, err := h.giftsService.GetGiftsIntel(ctx)
	if err != nil || intel == nil {
		msg := "⚠️ در حال حاضر امکان دریافت نبض بازار گیفت‌ها وجود ندارد."
		_ = tg.SendMessage(ctx, m.Chat.ID, msg, &m.MessageID, m.MessageThreadID)
		return
	}

	var sb strings.Builder
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

	markup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{"text": "🚀 مشاهده نقشه ژنتیکی و بازار در مینی‌اپ", "url": miniAppURL + "?startapp=gifts"},
			},
		},
	}

	_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, sb.String(), markup, m.MessageThreadID, "HTML")
}

// handleGiftLinkSniff detects t.me/nft/... or fragment.com/gift/... and provides instant valuation
func (h *WebhookHandler) handleGiftLinkSniff(ctx context.Context, bot *repository.ManagedBot, m *Message, linkRef string) {
	if h.giftsService == nil {
		return
	}

	token, _ := crypto.DecryptToken(bot.BotTokenEncrypted)
	if token == "" {
		return
	}
	tg := telegram.NewBotAPIClient(token)

	val, err := h.giftsService.GetBotGiftAppraisal(ctx, linkRef)
	if err != nil || val == nil {
		return
	}

	miniAppURL := os.Getenv("MINI_APP_URL")
	if miniAppURL == "" {
		miniAppURL = "https://t.me/iFragmentBot/iFragment"
	}

	msgText, markup := h.formatGiftAppraisalMessage(val, miniAppURL)
	_, _ = tg.SendMessageWithMarkup(ctx, m.Chat.ID, msgText, markup, m.MessageThreadID, "HTML")
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

	if query == "" || strings.EqualFold(query, "gifts") {
		// Return Market Overview Article
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
	} else {
		// Specific gift query (e.g. "pepe 42" or "CelestialStar-1")
		val, err := h.giftsService.GetBotGiftAppraisal(ctx, query)
		if err == nil && val != nil {
			fairTON := val.Pillars.FairValueGRAM
			floorTON := val.Pillars.ObservedFloorGRAM
			msgText, markup := h.formatGiftAppraisalMessage(val, miniAppURL)

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

	_ = tg.AnswerInlineQuery(ctx, iq.ID, results, 10, false)
}

// formatGiftAppraisalMessage constructs a rich, beautiful Telegram card for a gift valuation
func (h *WebhookHandler) formatGiftAppraisalMessage(val *gvengine.GiftValuation, miniAppURL string) (string, map[string]interface{}) {
	fairTON := val.Pillars.FairValueGRAM
	floorTON := val.Pillars.ObservedFloorGRAM
	liqTON := val.Pillars.LiquidationValueGRAM
	askTON := val.Pillars.SuggestedAskGRAM

	var sb strings.Builder
	sb.WriteString("🎁 <b>کارشناسی ارزش گیفت تلگرام</b>\n")
	sb.WriteString(fmt.Sprintf("💎 <b>%s</b>\n", telegram.EscapeHTML(val.DisplayTitle)))

	if val.OwnerName != "" {
		sb.WriteString(fmt.Sprintf("👤 <b>مالک کنونی:</b> <code>%s</code>\n", telegram.EscapeHTML(val.OwnerName)))
	}

	sb.WriteString("\n━━━━━━━━━━━━━━━━━━━━\n")
	sb.WriteString("🎯 <b>برآورد ارزش ۴ پایه‌ای (4-Pillar Valuation):</b>\n")
	sb.WriteString(fmt.Sprintf("• <b>برآورد ارزش تحلیلی (Fair Value):</b> <code>%.2f TON</code> (~$%.2f)\n", fairTON, val.ExpectedUSD))
	if floorTON > 0 {
		sb.WriteString(fmt.Sprintf("• <b>کف قیمت مشاهده‌شده:</b> <code>%.2f TON</code>\n", floorTON))
	}
	if liqTON > 0 {
		sb.WriteString(fmt.Sprintf("• <b>ارزش نقدشوندگی آنی:</b> <code>%.2f TON</code>\n", liqTON))
	}
	if askTON > 0 {
		sb.WriteString(fmt.Sprintf("• <b>قیمت پیشنهادی فروش:</b> <code>%.2f TON</code>\n", askTON))
	}

	// Trait DNA section
	if len(val.TraitDNA) > 0 {
		sb.WriteString("\n🧬 <b>ویژگی‌های ژنتیکی و کمیابی:</b>\n")
		for _, trait := range val.TraitDNA {
			label := trait.LabelFa
			if label == "" {
				label = trait.LabelEn
			}
			tier := trait.RarityTier
			if tier != "" {
				tier = " — " + tier
			}
			sb.WriteString(fmt.Sprintf("• %s: <b>%s</b> (کمیابی: <code>%.2f%%</code>%s)\n",
				telegram.EscapeHTML(label),
				telegram.EscapeHTML(trait.Value),
				trait.Percentile,
				telegram.EscapeHTML(tier)))
		}
	}

	// Serial Gravity
	sn := val.SerialNumber
	snTier := "استاندارد"
	snMult := 1.0
	switch {
	case sn == 1:
		snTier = "👑 تک خال مطلق (God Tier #1)"
		snMult = 3.5
	case sn <= 9:
		snTier = "⭐ تک رقمی (Single Digit)"
		snMult = 2.4
	case sn <= 99:
		snTier = "✨ دو رقمی (Double Digit)"
		snMult = 1.7
	case sn <= 999:
		snTier = "💠 سه رقمی (Triple Digit)"
		snMult = 1.3
	}
	if snMult > 1.0 {
		sb.WriteString(fmt.Sprintf("🔢 <b>گرانش سریال:</b> %s (ضریب: <code>%.2fx</code>)\n", snTier, snMult))
	}

	sb.WriteString("\n⚡ <i>برآورد تحلیلی بر پایه داده‌های ثبت‌شده بازار</i>")

	pascal := telegramnft.FormatPascalName(val.ModelID)
	fragmentURL := fmt.Sprintf("https://fragment.com/gift/%s-%d", pascal, val.SerialNumber)
	appGiftURL := fmt.Sprintf("%s?startapp=gift_%s-%d", miniAppURL, val.ModelID, val.SerialNumber)

	markup := map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{"text": "📊 مشاهده گزارش کامل در مینی‌اپ", "url": appGiftURL},
			},
			{
				{"text": "💎 مشاهده در فرگمنت", "url": fragmentURL},
			},
		},
	}

	return sb.String(), markup
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
