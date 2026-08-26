package handler

import (
	"context"
	"fmt"
	"log/slog"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/botmgmt"
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
func (h *WebhookHandler) handleManagedBotUpdated(ctx context.Context, bot *repository.ManagedBot, upd *ManagedBotUpdated) {
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

	token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
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
// is not a member. We answer with a short inline-style result pointing to the
// Mini App — the viral growth loop. Only username-like mentions are parsed;
// everything else gets the generic intro card.
func (h *WebhookHandler) handleGuestMessage(ctx context.Context, bot *repository.ManagedBot, upd *GuestMessageUpdate) {
	if upd == nil || upd.GuestQueryID == "" {
		return
	}

	token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	if err != nil {
		return
	}
	tg := telegram.NewBotAPIClient(token)

	article := map[string]interface{}{
		"type":  "article",
		"id":    "guest-intro",
		"title": "iFragment — Fragment Market Intelligence",
		"description": fmt.Sprintf("Valuations for usernames, +888 numbers & gifts. Mention me with any @handle!"),
		"input_message_content": map[string]interface{}{
			"message_text": "💎 <b>iFragment</b> — professional valuation for Telegram assets.\n\nMention me like: <code>@thisbot durov</code> or open the app below.",
		},
	}

	if err := tg.AnswerGuestQuery(ctx, upd.GuestQueryID, []map[string]interface{}{article}, 300); err != nil {
		slog.Warn("answerGuestQuery failed", "error", err)
	} else {
		slog.Info("guest query answered", "from_user", upd.From.ID, "chat_type", upd.Message.Chat.Type)
	}
}
