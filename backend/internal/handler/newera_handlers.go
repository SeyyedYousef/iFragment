package handler

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/crypto"
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

	token, err := crypto.DecryptToken(bot.BotTokenEncrypted)
	if err != nil {
		slog.Warn("bot_subscription_updated: cannot decrypt token", "error", err)
		return
	}
	tg := telegram.NewBotAPIClient(token)

	var userID int64
	if sub.UserID != 0 {
		userID = sub.UserID
	}

	switch {
	case sub.IsCanceled:
		text := "💔 <b>Your iFragment Pro subscription was canceled.</b>\n\n" +
			"You can re-subscribe anytime from the app to keep:\n• Daily deep valuations\n• Priority alerts\n• Pro badges\n\n" +
			"We'd love to have you back! 🙏"
		if userID != 0 {
			_ = tg.SendMessage(ctx, userID, text, nil, nil)
		}
		slog.Info("subscription canceled", "user", userID)
	case sub.IsRenewal:
		text := "🎉 <b>Your iFragment Pro subscription renewed!</b>\n\nEnjoy another month of premium intelligence."
		if userID != 0 {
			_ = tg.SendMessage(ctx, userID, text, nil, nil)
		}
		slog.Info("subscription renewed", "user", userID)
	case sub.IsExpired:
		text := "⏰ <b>Your iFragment Pro subscription expired.</b>\n\nRenew now in the app to keep your Pro features active."
		if userID != 0 {
			_ = tg.SendMessage(ctx, userID, text, nil, nil)
		}
		slog.Info("subscription expired", "user", userID)
	default:
		text := "👑 <b>Welcome to iFragment Pro!</b>\n\nYour subscription is active. Enjoy premium valuations & alerts."
		if userID != 0 {
			_ = tg.SendMessage(ctx, userID, text, nil, nil)
		}
		slog.Info("subscription started", "user", userID)
	}
}

// handleGuestMessage (Bot API 10.0): the bot was mentioned in a chat where it
// is not a member. We answer with a tailored interactive result pointing to the
// Mini App and bot chat — the viral growth loop.
func (h *WebhookHandler) handleGuestMessage(ctx context.Context, bot *repository.ManagedBot, upd *GuestMessageUpdate) {
	if upd == nil || upd.GuestQueryID == "" {
		return
	}

	token, err := crypto.DecryptToken(bot.BotTokenEncrypted)
	if err != nil {
		return
	}
	tg := telegram.NewBotAPIClient(token)

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
		switch sniff.Type {
		case "username":
			normUser := strings.TrimPrefix(strings.ToLower(sniff.Entity), "@")
			valText := fmt.Sprintf("🏷️ <b>کارشناسی نام کاربری: @%s</b>\n\n💎 استعلام هوشمند شاخص‌های سرمایه‌گذاری و ارزش منصفانه در iFragment آماده است.", normUser)
			desc := "مشاهده برآورد ارزش، کمیابی و نقدشوندگی در iFragment"

			if h.avmService != nil {
				res, err := h.avmService.Valuate(ctx, normUser, 0)
				if err == nil && res != nil {
					valText = fmt.Sprintf("🏷️ <b>کارشناسی نام کاربری: @%s</b>\n\n💎 درجه سرمایه‌گذاری: <b>%s</b>\n💰 برآورد منصفانه: <b>~%s TON (معادل $%s)</b>\n📈 شاخص برندپذیری: <b>%d / 100</b>\n⚡ رتبه نقدشوندگی: <b>%s</b>\n\n🔍 <i>تحلیل دقیق الگوریتمی موتور هوشمند AVM در فرگمنت</i>",
						normUser,
						res.InvestmentGrade,
						res.ExpectedTON.StringFixed(1), res.ExpectedUSD.StringFixed(0),
						res.Brandability,
						res.LiquidityRating,
					)
					desc = fmt.Sprintf("ارزش منصفانه: ~%s TON ($%s) | درجه: %s", res.ExpectedTON.StringFixed(1), res.ExpectedUSD.StringFixed(0), res.InvestmentGrade)
				}
			}

			article = map[string]interface{}{
				"type":        "article",
				"id":          "guest-username-" + normUser,
				"title":       fmt.Sprintf("🔍 کارشناسی نام کاربری: @%s", normUser),
				"description": desc,
				"input_message_content": map[string]interface{}{
					"message_text": valText,
					"parse_mode":   "HTML",
				},
				"reply_markup": map[string]interface{}{
					"inline_keyboard": [][]map[string]interface{}{
						{
							{"text": "📊 مشاهده تحلیل جامع در مینی‌اپ", "url": fmt.Sprintf("%s?startapp=val_%s", miniAppURL, normUser)},
						},
						{
							{"text": "🤖 دریافت گزارش کامل در ربات", "url": fmt.Sprintf("https://t.me/%s?start=username_%s", bot.BotUsername, normUser)},
						},
					},
				},
			}

		case "number":
			cleanNum := features.CleanNumber(sniff.Entity)
			valText := fmt.Sprintf("📱 <b>کارشناسی شماره کلکسیونی: %s</b>\n\n💎 ارزیابی رتبه شبکه TON، کلوپ اختصاصی و قیمت منصفانه در دسترس است.", sniff.Entity)
			desc := "برآورد ارزش و رتبه کمیابی در میان ۱۳۶,۵۶۶ شماره"

			if h.numbersService != nil {
				val, err := h.numbersService.ValuateNumber(ctx, 0, sniff.Entity)
				if err == nil && val != nil {
					club := val.CategoryClubFa
					if club == "" {
						club = val.CategoryClub
					}
					valText = fmt.Sprintf("📱 <b>کارشناسی شماره کلکسیونی: %s</b>\n\n👑 کلوپ: <b>%s</b>\n🏆 رتبه کمیابی: <b>#%d از ۱۳۶,۵۶۶</b>\n💰 قیمت منصفانه (Fair): <b>%s TON (~$%.0f)</b>\n🎯 ضریب اطمینان: <b>%d%%</b>\n\n⚡ <i>ارزیابی دقیق موتور NV Engine بر اساس متدولوژی ثبت‌شده در TON</i>",
						val.DisplayNumber,
						club,
						val.GlobalRank,
						val.ExpectedTON.StringFixed(1), val.ExpectedUSD,
						val.ConfidenceScore,
					)
					desc = fmt.Sprintf("کلوپ: %s | قیمت منصفانه: %s TON (~$%.0f)", club, val.ExpectedTON.StringFixed(1), val.ExpectedUSD)
				}
			}

			article = map[string]interface{}{
				"type":        "article",
				"id":          "guest-num-" + cleanNum,
				"title":       fmt.Sprintf("📱 کارشناسی شماره: %s", sniff.Entity),
				"description": desc,
				"input_message_content": map[string]interface{}{
					"message_text": valText,
					"parse_mode":   "HTML",
				},
				"reply_markup": map[string]interface{}{
					"inline_keyboard": [][]map[string]interface{}{
						{
							{"text": "📊 مشاهده تحلیل جامع در مینی‌اپ", "url": fmt.Sprintf("%s?startapp=num_%s", miniAppURL, cleanNum)},
						},
						{
							{"text": "🤖 دریافت گزارش کامل در ربات", "url": fmt.Sprintf("https://t.me/%s?start=number_%s", bot.BotUsername, cleanNum)},
						},
					},
				},
			}

		case "gift":
			valText := fmt.Sprintf("🎁 <b>تحلیل گیفت تلگرام: %s</b>\n\n💎 بررسی زنده کف قیمت بازار، کمیابی ژنتیکی صفات و تحلیل منصفانه فرگمنت.", sniff.Entity)
			desc := "کف قیمت زنده، ویژگی‌های صفات و ارزش‌گذاری"

			if h.giftsService != nil {
				appraisal, err := h.giftsService.GetBotGiftAppraisal(ctx, sniff.Entity)
				if err == nil && appraisal != nil {
					fairTON := appraisal.Pillars.FairValueGRAM
					floorTON := appraisal.Pillars.ObservedFloorGRAM
					valText = fmt.Sprintf("🎁 <b>کارشناسی گیفت تلگرام: %s</b>\n\n💎 ارزش منصفانه: <b>%.1f TON (~$%.0f)</b>\n🌊 کف قیمت بازار: <b>%.1f TON</b>\n#️⃣ شماره سریال: <b>#%d</b>\n🎯 ضریب اطمینان: <b>%d%%</b>\n\n⚡ <i>ارزیابی ۴ پایه‌ای موتور GV Engine بر پایه داده‌های آن‌چین</i>",
						appraisal.DisplayTitle,
						fairTON, appraisal.ExpectedUSD,
						floorTON,
						appraisal.SerialNumber,
						appraisal.ConfidenceScore,
					)
					desc = fmt.Sprintf("ارزش منصفانه: %.1f TON | کف: %.1f TON | سریال #%d", fairTON, floorTON, appraisal.SerialNumber)
				}
			}

			article = map[string]interface{}{
				"type":        "article",
				"id":          "guest-gift-" + sniff.Entity,
				"title":       fmt.Sprintf("🎁 کارشناسی گیفت: %s", sniff.Entity),
				"description": desc,
				"input_message_content": map[string]interface{}{
					"message_text": valText,
					"parse_mode":   "HTML",
				},
				"reply_markup": map[string]interface{}{
					"inline_keyboard": [][]map[string]interface{}{
						{
							{"text": "📊 مشاهده در مینی‌اپ", "url": fmt.Sprintf("%s?startapp=gift_%s", miniAppURL, sniff.Entity)},
						},
						{
							{"text": "🤖 دریافت در پیوی ربات", "url": fmt.Sprintf("https://t.me/%s?start=gift_%s", bot.BotUsername, sniff.Entity)},
						},
					},
				},
			}
		}
	}

	if article == nil {
		article = map[string]interface{}{
			"type":        "article",
			"id":          "guest-intro",
			"title":       "iFragment — هوش بازار و کارشناسی تلگرام",
			"description": "کارشناسی ارزش نام کاربری، شماره +888 و گیفت‌ها. با منشن کردن استعلام بگیرید!",
			"input_message_content": map[string]interface{}{
				"message_text": "💎 <b>iFragment</b> — سیستم ارزیابی و اطلاعات بازار دارایی‌های تلگرام.\n\nاستعلام در هر گروه با منشن: <code>@" + bot.BotUsername + " durov</code> یا ورود به مینی‌اپ:",
				"parse_mode":   "HTML",
			},
			"reply_markup": map[string]interface{}{
				"inline_keyboard": [][]map[string]interface{}{
					{
						{"text": "🚀 باز کردن iFragment", "url": miniAppURL},
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
