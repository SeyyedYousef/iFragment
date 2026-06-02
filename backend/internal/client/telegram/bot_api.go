package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/sony/gobreaker"
)

type BotAPIClient struct {
	token   string
	client  *http.Client
	baseURL string
	cb      *gobreaker.CircuitBreaker
}

func NewBotAPIClient(token string) *BotAPIClient {
	baseURL := os.Getenv("TELEGRAM_API_URL")
	if baseURL == "" {
		baseURL = "https://api.telegram.org"
	}

	cbSettings := gobreaker.Settings{
		Name:        "telegram-bot-api",
		MaxRequests: 5,
		Interval:    60 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.ConsecutiveFailures >= 5
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			slog.Warn("Circuit breaker state change",
				"name", name,
				"from", from.String(),
				"to", to.String(),
			)
		},
	}

	return &BotAPIClient{
		token:   token,
		baseURL: baseURL,
		client: &http.Client{
			Timeout: 10 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 20,
				IdleConnTimeout:     90 * time.Second,
			},
		},
		cb: gobreaker.NewCircuitBreaker(cbSettings),
	}
}

// EscapeHTML escapes special HTML characters in text for Telegram HTML parse_mode.
func EscapeHTML(text string) string {
	r := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
	)
	return r.Replace(text)
}

// apiResponse represents the standard Telegram Bot API response.
type apiResponse struct {
	OK          bool            `json:"ok"`
	Result      json.RawMessage `json:"result"`
	Description string          `json:"description"`
	ErrorCode   int             `json:"error_code"`
	Parameters  *struct {
		RetryAfter int `json:"retry_after"`
	} `json:"parameters,omitempty"`
}

func (c *BotAPIClient) maskTokenInError(err error) error {
	if err == nil {
		return nil
	}
	errStr := err.Error()
	if c.token != "" && strings.Contains(errStr, c.token) {
		return fmt.Errorf("%s", strings.ReplaceAll(errStr, c.token, "xxxx_masked_token"))
	}
	return err
}

func (c *BotAPIClient) Request(ctx context.Context, method string, payload interface{}) (json.RawMessage, error) {
	result, err := c.cb.Execute(func() (interface{}, error) {
		return c.doRequestWithRetry(ctx, method, payload)
	})
	if err != nil {
		return nil, c.maskTokenInError(err)
	}
	return result.(json.RawMessage), nil
}

func (c *BotAPIClient) doRequestWithRetry(ctx context.Context, method string, payload interface{}) (json.RawMessage, error) {
	url := fmt.Sprintf("%s/bot%s/%s", c.baseURL, c.token, method)
	body, _ := json.Marshal(payload)

	const maxRetries = 3

	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff: 500ms, 1s, 2s
			backoff := time.Duration(500*math.Pow(2, float64(attempt-1))) * time.Millisecond
			slog.Info("Retrying Telegram API request",
				"method", method,
				"attempt", attempt+1,
				"backoff", backoff,
			)
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
			}
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(body))
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := c.client.Do(req)
		if err != nil {
			// Network error — retryable
			if attempt < maxRetries-1 {
				continue
			}
			return nil, c.maskTokenInError(fmt.Errorf("telegram api network error after %d attempts: %w", maxRetries, err))
		}

		var result apiResponse
		decodeErr := json.NewDecoder(resp.Body).Decode(&result)
		resp.Body.Close()

		if decodeErr != nil {
			if attempt < maxRetries-1 {
				continue
			}
			return nil, fmt.Errorf("failed to decode telegram response: %w", decodeErr)
		}

		// Success
		if result.OK {
			return result.Result, nil
		}

		// Handle 429 Too Many Requests — respect retry_after
		if result.ErrorCode == 429 && result.Parameters != nil && result.Parameters.RetryAfter > 0 {
			retryAfter := time.Duration(result.Parameters.RetryAfter) * time.Second
			slog.Warn("Telegram rate limit hit, waiting retry_after",
				"method", method,
				"retry_after_seconds", result.Parameters.RetryAfter,
			)
			if attempt < maxRetries-1 {
				select {
				case <-ctx.Done():
					return nil, ctx.Err()
				case <-time.After(retryAfter):
				}
				continue
			}
		}

		// Handle 5xx server errors — retryable
		if result.ErrorCode >= 500 && attempt < maxRetries-1 {
			continue
		}

		// Non-retryable error (4xx except 429)
		return nil, fmt.Errorf("telegram api error [%d]: %s", result.ErrorCode, result.Description)
	}

	return nil, fmt.Errorf("telegram api: max retries exceeded for method %s", method)
}

func (c *BotAPIClient) DeleteMessage(ctx context.Context, chatID int64, messageID int) error {
	_, err := c.Request(ctx, "deleteMessage", map[string]interface{}{
		"chat_id":    chatID,
		"message_id": messageID,
	})
	return err
}

func (c *BotAPIClient) SendMessage(ctx context.Context, chatID int64, text string, replyToID *int, threadID *int) error {
	_, err := c.SendMessageWithResult(ctx, chatID, text, replyToID, threadID)
	return err
}

type MessageResult struct {
	MessageID int `json:"message_id"`
}

func (c *BotAPIClient) SendMessageWithResult(ctx context.Context, chatID int64, text string, replyToID *int, threadID *int) (*MessageResult, error) {
	payload := map[string]interface{}{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "HTML",
	}
	if replyToID != nil {
		payload["reply_to_message_id"] = *replyToID
	}
	if threadID != nil {
		payload["message_thread_id"] = *threadID
	}
	resp, err := c.Request(ctx, "sendMessage", payload)
	if err != nil {
		return nil, err
	}
	var res MessageResult
	if err := json.Unmarshal(resp, &res); err != nil {
		return nil, fmt.Errorf("failed to parse message result: %w", err)
	}
	return &res, nil
}

func (c *BotAPIClient) GetChatMember(ctx context.Context, chatID interface{}, userID int64) (string, error) {
	resp, err := c.Request(ctx, "getChatMember", map[string]interface{}{
		"chat_id": chatID,
		"user_id": userID,
	})
	if err != nil {
		return "", err
	}
	var member struct {
		Status string `json:"status"`
	}
	if err := json.Unmarshal(resp, &member); err != nil {
		return "", fmt.Errorf("failed to parse member status: %w", err)
	}
	return member.Status, nil
}

func (c *BotAPIClient) ApproveChatJoinRequest(ctx context.Context, chatID interface{}, userID int64) error {
	_, err := c.Request(ctx, "approveChatJoinRequest", map[string]interface{}{
		"chat_id": chatID,
		"user_id": userID,
	})
	return err
}

func (c *BotAPIClient) RestrictChatMember(ctx context.Context, chatID int64, userID int64, untilDate int64) error {
	_, err := c.Request(ctx, "restrictChatMember", map[string]interface{}{
		"chat_id": chatID,
		"user_id": userID,
		"permissions": map[string]bool{
			"can_send_messages": false,
		},
		"until_date": untilDate,
	})
	return err
}

func (c *BotAPIClient) BanChatMember(ctx context.Context, chatID int64, userID int64, untilDate int64, revokeMessages bool) error {
	_, err := c.Request(ctx, "banChatMember", map[string]interface{}{
		"chat_id":         chatID,
		"user_id":         userID,
		"until_date":      untilDate,
		"revoke_messages": revokeMessages,
	})
	return err
}

func (c *BotAPIClient) UnbanChatMember(ctx context.Context, chatID int64, userID int64, onlyIfBanned bool) error {
	_, err := c.Request(ctx, "unbanChatMember", map[string]interface{}{
		"chat_id":        chatID,
		"user_id":        userID,
		"only_if_banned": onlyIfBanned,
	})
	return err
}

func (c *BotAPIClient) UnrestrictChatMember(ctx context.Context, chatID int64, userID int64) error {
	_, err := c.Request(ctx, "restrictChatMember", map[string]interface{}{
		"chat_id":    chatID,
		"user_id":    userID,
		"permissions": map[string]bool{
			"can_send_messages":       true,
			"can_send_media_messages": true,
			"can_send_polls":          true,
			"can_send_other_messages": true,
			"can_add_web_page_previews": true,
			"can_invite_users":        true,
			"can_pin_messages":        true,
		},
	})
	return err
}

func (c *BotAPIClient) SendMessageWithMarkup(ctx context.Context, chatID int64, text string, markup interface{}, threadID *int) (*MessageResult, error) {
	payload := map[string]interface{}{
		"chat_id":      chatID,
		"text":         text,
		"parse_mode":   "HTML",
		"reply_markup": markup,
	}
	if threadID != nil {
		payload["message_thread_id"] = *threadID
	}
	resp, err := c.Request(ctx, "sendMessage", payload)
	if err != nil {
		return nil, err
	}
	var res MessageResult
	if err := json.Unmarshal(resp, &res); err != nil {
		return nil, fmt.Errorf("failed to parse message result: %w", err)
	}
	return &res, nil
}

func (c *BotAPIClient) AnswerCallbackQuery(ctx context.Context, queryID string, text string, showAlert bool) error {
	_, err := c.Request(ctx, "answerCallbackQuery", map[string]interface{}{
		"callback_query_id": queryID,
		"text":              text,
		"show_alert":        showAlert,
	})
	return err
}

func (c *BotAPIClient) PinChatMessage(ctx context.Context, chatID int64, messageID int) error {
	_, err := c.Request(ctx, "pinChatMessage", map[string]interface{}{
		"chat_id":    chatID,
		"message_id": messageID,
	})
	return err
}

type User struct {
	ID        int64  `json:"id"`
	IsBot     bool   `json:"is_bot"`
	FirstName string `json:"first_name"`
	Username  string `json:"username,omitempty"`
}

func (c *BotAPIClient) GetMe(ctx context.Context) (*User, error) {
	resp, err := c.Request(ctx, "getMe", nil)
	if err != nil {
		return nil, err
	}
	var me User
	if err := json.Unmarshal(resp, &me); err != nil {
		return nil, err
	}
	return &me, nil
}

func (c *BotAPIClient) GetChatMemberCount(ctx context.Context, chatID interface{}) (int, error) {
	resp, err := c.Request(ctx, "getChatMemberCount", map[string]interface{}{
		"chat_id": chatID,
	})
	if err != nil {
		return 0, err
	}
	var count int
	err = json.Unmarshal(resp, &count)
	return count, err
}

type ChatResult struct {
	ID    int64  `json:"id"`
	Type  string `json:"type"`
	Title string `json:"title,omitempty"`
}

func (c *BotAPIClient) GetChat(ctx context.Context, chatID interface{}) (*ChatResult, error) {
	resp, err := c.Request(ctx, "getChat", map[string]interface{}{
		"chat_id": chatID,
	})
	if err != nil {
		return nil, err
	}
	var res ChatResult
	if err := json.Unmarshal(resp, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

// ForwardMessage forwards a Telegram message from one chat to another
func (c *BotAPIClient) ForwardMessage(ctx context.Context, targetChatID interface{}, fromChatID int64, messageID int) error {
	_, err := c.Request(ctx, "forwardMessage", map[string]interface{}{
		"chat_id":              targetChatID,
		"from_chat_id":         fromChatID,
		"message_id":           messageID,
	})
	return err
}

type ChatMemberAdmin struct {
	User        User   `json:"user"`
	Status      string `json:"status"` // "creator", "administrator"
	CustomTitle string `json:"custom_title,omitempty"`
}

// GetChatAdministrators retrieves a list of administrators for a Telegram chat
func (c *BotAPIClient) GetChatAdministrators(ctx context.Context, chatID interface{}) ([]ChatMemberAdmin, error) {
	resp, err := c.Request(ctx, "getChatAdministrators", map[string]interface{}{
		"chat_id": chatID,
	})
	if err != nil {
		return nil, err
	}
	var admins []ChatMemberAdmin
	err = json.Unmarshal(resp, &admins)
	return admins, err
}

// EditMessageReplyMarkup edits the reply markup of a message
func (c *BotAPIClient) EditMessageReplyMarkup(ctx context.Context, chatID interface{}, messageID int, markup interface{}) error {
	_, err := c.Request(ctx, "editMessageReplyMarkup", map[string]interface{}{
		"chat_id":      chatID,
		"message_id":   messageID,
		"reply_markup": markup,
	})
	return err
}

// EditMessageText edits the text of a message
func (c *BotAPIClient) EditMessageText(ctx context.Context, chatID interface{}, messageID int, text string) error {
	_, err := c.Request(ctx, "editMessageText", map[string]interface{}{
		"chat_id":    chatID,
		"message_id": messageID,
		"text":       text,
		"parse_mode": "HTML",
	})
	return err
}

// EditMessageTextWithMarkup edits both text and markup of a message
func (c *BotAPIClient) EditMessageTextWithMarkup(ctx context.Context, chatID interface{}, messageID int, text string, markup interface{}) error {
	_, err := c.Request(ctx, "editMessageText", map[string]interface{}{
		"chat_id":      chatID,
		"message_id":   messageID,
		"text":         text,
		"parse_mode":   "HTML",
		"reply_markup": markup,
	})
	return err
}

type StarTransaction struct {
	ID     string `json:"id"`
	Amount int    `json:"amount"`
	Date   int    `json:"date"`
	Source struct {
		Type string `json:"type"`
		User *User  `json:"user,omitempty"`
	} `json:"source"`
	Receiver struct {
		Type string `json:"type"`
	} `json:"receiver"`
}

type StarTransactions struct {
	Transactions []StarTransaction `json:"transactions"`
}

func (c *BotAPIClient) GetStarTransactions(ctx context.Context) (*StarTransactions, error) {
	resp, err := c.Request(ctx, "getStarTransactions", nil)
	if err != nil {
		return nil, err
	}
	var res StarTransactions
	if err := json.Unmarshal(resp, &res); err != nil {
		return nil, err
	}
	return &res, nil
}
