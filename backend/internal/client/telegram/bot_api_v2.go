package telegram

import (
	"context"
	"encoding/json"
	"fmt"
)

// ============================================================================
// Telegram Bot API 9.4 → 10.3 (2026) — New-era methods
// Added 2026-08-25 as part of the "world's best bot" upgrade initiative.
// Every method follows the existing client conventions: generic Request(),
// map payloads, tolerant parsing, and graceful degradation on old servers.
// ============================================================================

// ─── Member Tags (Bot API 9.5, March 2026) ────────────────────────────────

// SetChatMemberTag sets or clears a short label ("tag") shown next to a
// member's name in the chat. Pass tag="" to clear. Requires the bot to be an
// administrator with can_manage_tags.
func (c *BotAPIClient) SetChatMemberTag(ctx context.Context, chatID interface{}, userID int64, tag string) error {
	payload := map[string]interface{}{
		"chat_id": chatID,
		"user_id": userID,
	}
	if tag != "" {
		payload["tag"] = tag
	} else {
		// Explicit empty string clears the tag server-side.
		payload["tag"] = ""
	}
	_, err := c.Request(ctx, "setChatMemberTag", payload)
	return err
}

// GetChatMemberTag fetches a member's current tag via getChatMember.
// Returns "" when the member has no tag.
func (c *BotAPIClient) GetChatMemberTag(ctx context.Context, chatID interface{}, userID int64) (string, error) {
	payload := map[string]interface{}{
		"chat_id": chatID,
		"user_id": userID,
	}
	raw, err := c.Request(ctx, "getChatMember", payload)
	if err != nil {
		return "", err
	}
	var member struct {
		Tag    *string `json:"tag,omitempty"`
		Status string  `json:"status"`
	}
	if err := json.Unmarshal(raw, &member); err != nil {
		return "", fmt.Errorf("failed to parse chat member: %w", err)
	}
	if member.Tag == nil {
		return "", nil
	}
	return *member.Tag, nil
}

// ─── Rich Messages (Bot API 10.1–10.3, June–August 2026) ──────────────────

// SendRichMessage sends a highly structured rich message (blocks/tables/
// collapsible sections). richMessage is the InputRichMessage object.
func (c *BotAPIClient) SendRichMessage(ctx context.Context, chatID int64, richMessage map[string]interface{}) (*EphemeralMessageResult, error) {
	payload := map[string]interface{}{
		"chat_id":      chatID,
		"rich_message": richMessage,
	}
	raw, err := c.Request(ctx, "sendRichMessage", payload)
	if err != nil {
		return nil, err
	}
	var msg EphemeralMessageResult
	if err := json.Unmarshal(raw, &msg); err != nil {
		return nil, fmt.Errorf("failed to parse rich message result: %w", err)
	}
	return &msg, nil
}

// SendRichMessageDraft streams a partial rich message while it is being
// generated (AI typing effect). Call with done=false repeatedly and finish
// with done=true.
func (c *BotAPIClient) SendRichMessageDraft(ctx context.Context, chatID int64, draftText string, done bool) error {
	payload := map[string]interface{}{
		"chat_id": chatID,
		"draft":   draftText,
		"done":    done,
	}
	_, err := c.Request(ctx, "sendRichMessageDraft", payload)
	return err
}

// SendMessageDraft streams a plain-text partial message to the user while it
// is being generated (available to all bots since Bot API 9.5).
func (c *BotAPIClient) SendMessageDraft(ctx context.Context, chatID int64, text string, done bool) error {
	payload := map[string]interface{}{
		"chat_id": chatID,
		"text":    text,
		"done":    done,
	}
	_, err := c.Request(ctx, "sendMessageDraft", payload)
	return err
}

// EditRichMessage edits an existing message's content into / as a rich
// message (rich_message parameter of editMessageText).
func (c *BotAPIClient) EditRichMessage(ctx context.Context, chatID interface{}, messageID int, richMessage map[string]interface{}) error {
	payload := map[string]interface{}{
		"chat_id":      chatID,
		"message_id":   messageID,
		"rich_message": richMessage,
	}
	_, err := c.Request(ctx, "editMessageText", payload)
	return err
}

// ─── Gifts (Bot API 9.3–9.4, December 2025 – February 2026) ───────────────

// GiftSummary is a compact projection of a unique gift from getUserGifts /
// getChatGifts responses.
type GiftSummary struct {
	GiftID            string  `json:"gift_id,omitempty"`
	BaseGiftID        string  `json:"base_gift_id,omitempty"`
	Model             string  `json:"model,omitempty"`
	Symbol            string  `json:"symbol,omitempty"`
	Backdrop          string  `json:"backdrop,omitempty"`
	Number            int64   `json:"number,omitempty"`
	Rarity            float64 `json:"rarity,omitempty"` // official model rarity (9.4)
	IsBurned          bool    `json:"is_burned,omitempty"`
	LastResaleCurrency string `json:"last_resale_currency,omitempty"`
	LastResaleAmount   float64 `json:"last_resale_amount,omitempty"`
}

type userGiftsResponse struct {
	TotalCount int          `json:"total_count"`
	Gifts      []struct {
		Gift struct {
			GiftID    string `json:"gift_id,omitempty"`
			BaseName  string `json:"base_name,omitempty"`
			Model     *struct {
				Name   string  `json:"name"`
				Rarity float64 `json:"rarity"`
			} `json:"model,omitempty"`
			Symbol   *struct {
				Name string `json:"name"`
			} `json:"symbol,omitempty"`
			Backdrop *struct {
				Name string `json:"name"`
			} `json:"backdrop,omitempty"`
			Number       int64   `json:"number,omitempty"`
			IsBurned     bool    `json:"is_burned,omitempty"`
			ResaleInfo   *struct {
				Currency string  `json:"last_resale_currency,omitempty"`
				Amount   float64 `json:"last_resale_amount,omitempty"`
			} `json:"unique_gift_info,omitempty"`
		} `json:"gift"`
	} `json:"gifts"`
}

func parseGiftSummaries(raw json.RawMessage) []GiftSummary {
	var resp userGiftsResponse
	if err := json.Unmarshal(raw, &resp); err != nil {
		return nil
	}
	out := make([]GiftSummary, 0, len(resp.Gifts))
	for _, g := range resp.Gifts {
		s := GiftSummary{
			GiftID: g.Gift.GiftID,
		}
		if g.Gift.Model != nil {
			s.Model = g.Gift.Model.Name
			s.Rarity = g.Gift.Model.Rarity
		}
		if g.Gift.Symbol != nil {
			s.Symbol = g.Gift.Symbol.Name
		}
		if g.Gift.Backdrop != nil {
			s.Backdrop = g.Gift.Backdrop.Name
		}
		s.Number = g.Gift.Number
		s.IsBurned = g.Gift.IsBurned
		if g.Gift.ResaleInfo != nil {
			s.LastResaleCurrency = g.Gift.ResaleInfo.Currency
			s.LastResaleAmount = g.Gift.ResaleInfo.Amount
		}
		out = append(out, s)
	}
	return out
}

// GetUserGifts returns gifts owned by a user (Bot API 9.3). Requires the
// target user to have allowed gift visibility for the bot.
func (c *BotAPIClient) GetUserGifts(ctx context.Context, userID int64, limit int) ([]GiftSummary, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	payload := map[string]interface{}{
		"user_id": userID,
		"limit":   limit,
	}
	raw, err := c.Request(ctx, "getUserGifts", payload)
	if err != nil {
		return nil, 0, err
	}
	gifts := parseGiftSummaries(raw)
	var resp userGiftsResponse
	_ = json.Unmarshal(raw, &resp)
	return gifts, resp.TotalCount, nil
}

// GetChatGifts returns gifts owned by a channel/group (Bot API 9.3).
func (c *BotAPIClient) GetChatGifts(ctx context.Context, chatID interface{}, limit int) ([]GiftSummary, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	payload := map[string]interface{}{
		"chat_id": chatID,
		"limit":   limit,
	}
	raw, err := c.Request(ctx, "getChatGifts", payload)
	if err != nil {
		return nil, 0, err
	}
	gifts := parseGiftSummaries(raw)
	var resp userGiftsResponse
	_ = json.Unmarshal(raw, &resp)
	return gifts, resp.TotalCount, nil
}

// SetUserEmojiStatus changes the emoji status of a user on behalf of the bot
// (the bot must be allowed to manage the user's emoji status; used by bots
// that users have granted this via their profile/bot interaction).
// Pass customEmojiID="" to clear the status.
func (c *BotAPIClient) SetUserEmojiStatus(ctx context.Context, userID int64, customEmojiID string) error {
	payload := map[string]interface{}{"user_id": userID}
	if customEmojiID != "" {
		payload["emoji_status_custom_emoji_id"] = customEmojiID
	}
	_, err := c.Request(ctx, "setUserEmojiStatus", payload)
	return err
}

// ─── Guest Mode (Bot API 10.0, May 2026) ──────────────────────────────────

// AnswerGuestQuery responds to a guest query (a mention in a chat where the
// bot is not a member). results are WebApp-style inline query results;
// pass cachedTime 0 for default caching.
func (c *BotAPIClient) AnswerGuestQuery(ctx context.Context, guestQueryID string, results []map[string]interface{}, cacheTime int) error {
	payload := map[string]interface{}{
		"guest_query_id": guestQueryID,
		"results":        results,
	}
	if cacheTime > 0 {
		payload["cache_time"] = cacheTime
	}
	_, err := c.Request(ctx, "answerGuestQuery", payload)
	return err
}

// ─── Join Request Web App gate (Bot API 10.1, June 2026) ──────────────────

// SendChatJoinRequestWebApp opens a Mini App for the joining user inside
// their join-request flow (interactive captcha / terms gate). webAppURL must
// be HTTPS and match the bot's configured Mini App domain policy.
func (c *BotAPIClient) SendChatJoinRequestWebApp(ctx context.Context, chatID interface{}, userID int64, webAppURL string) error {
	payload := map[string]interface{}{
		"chat_id": chatID,
		"user_id": userID,
		"url":     webAppURL,
	}
	_, err := c.Request(ctx, "sendChatJoinRequestWebApp", payload)
	return err
}

// ─── Managed Bots (Bot API 9.6, April 2026) ───────────────────────────────

// GetManagedBotToken retrieves the current token of a bot managed by this
// manager bot. managedBotUserID is the numeric ID of the managed bot.
func (c *BotAPIClient) GetManagedBotToken(ctx context.Context, managedBotUserID int64) (string, error) {
	payload := map[string]interface{}{"user_id": managedBotUserID}
	raw, err := c.Request(ctx, "getManagedBotToken", payload)
	if err != nil {
		return "", err
	}
	var res struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(raw, &res); err != nil {
		return "", fmt.Errorf("failed to parse managed bot token: %w", err)
	}
	return res.Token, nil
}

// ReplaceManagedBotToken rotates the token of a managed bot and returns the
// new one. Any previously issued token stops working immediately.
func (c *BotAPIClient) ReplaceManagedBotToken(ctx context.Context, managedBotUserID int64) (string, error) {
	payload := map[string]interface{}{"user_id": managedBotUserID}
	raw, err := c.Request(ctx, "replaceManagedBotToken", payload)
	if err != nil {
		return "", err
	}
	var res struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(raw, &res); err != nil {
		return "", fmt.Errorf("failed to parse replaced managed bot token: %w", err)
	}
	return res.Token, nil
}

// ─── Live Photos (Bot API 10.0, May 2026) ─────────────────────────────────

// SendLivePhoto sends a photo with a short accompanying video (live photo).
func (c *BotAPIClient) SendLivePhoto(ctx context.Context, chatID int64, photoURL, videoURL string, caption ...string) error {
	payload := map[string]interface{}{
		"chat_id":   chatID,
		"photo":     photoURL,
		"live_video": videoURL,
	}
	if len(caption) > 0 && caption[0] != "" {
		payload["caption"] = caption[0]
	}
	_, err := c.Request(ctx, "sendLivePhoto", payload)
	return err
}

// ─── Enhanced buttons (Bot API 9.3/9.4/10.3) ──────────────────────────────

// InlineButton is a typed helper for building inline keyboard rows that may
// carry the newer optional fields. Existing call sites passing raw maps keep
// working unchanged; use this only when the extra fields are needed.
type InlineButton struct {
	Text                         string  `json:"text"`
	URL                          string  `json:"url,omitempty"`
	CallbackData                 string  `json:"callback_data,omitempty"`
	SwitchInlineQuery            string  `json:"switch_inline_query,omitempty"`
	SwitchInlineQueryCurrentChat string  `json:"switch_inline_query_current_chat,omitempty"`
	Pay                          bool    `json:"pay,omitempty"`
	Style                        string  `json:"style,omitempty"`           // 9.4: e.g. "danger"
	Disabled                     bool    `json:"disabled,omitempty"`         // 10.3
	IconCustomEmojiID            string  `json:"icon_custom_emoji_id,omitempty"` // 9.3
}

// BuildInlineKeyboard converts [][]InlineButton to the raw reply_markup map
// accepted by sendMessage-family payloads.
func BuildInlineKeyboard(rows [][]InlineButton) map[string]interface{} {
	grid := make([][]map[string]interface{}, 0, len(rows))
	for _, row := range rows {
		r := make([]map[string]interface{}, 0, len(row))
		for _, b := range row {
			data, _ := json.Marshal(b)
			var m map[string]interface{}
			_ = json.Unmarshal(data, &m)
			r = append(r, m)
		}
		grid = append(grid, r)
	}
	return map[string]interface{}{"inline_keyboard": grid}
}
