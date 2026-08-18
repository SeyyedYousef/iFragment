package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/sony/gobreaker"
)

var (
	ErrUnauthorized    = errors.New("telegram api: unauthorized (invalid token)")
	ErrNotFound        = errors.New("telegram api: not found (invalid token format or endpoint)")
	ErrForbidden       = errors.New("telegram api: forbidden (bot was blocked or removed)")
	ErrMessageNotFound = errors.New("telegram api: message to delete not found")
)

type APIError struct {
	Code    int
	Message string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("telegram api error [%d]: %s", e.Code, e.Message)
}

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
		IsSuccessful: func(err error) bool {
			if err == nil {
				return true
			}
			if errors.Is(err, ErrUnauthorized) || errors.Is(err, ErrNotFound) || errors.Is(err, ErrForbidden) || errors.Is(err, ErrMessageNotFound) {
				return true
			}
			var apiErr *APIError
			if errors.As(err, &apiErr) {
				if apiErr.Code >= 400 && apiErr.Code < 500 {
					return true
				}
			}
			return false
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

// IsNil checks if an interface is nil, including typed nil pointers, maps, slices, or channels.
func IsNil(i interface{}) bool {
	if i == nil {
		return true
	}
	v := reflect.ValueOf(i)
	switch v.Kind() {
	case reflect.Chan, reflect.Func, reflect.Map, reflect.Pointer, reflect.UnsafePointer, reflect.Interface, reflect.Slice:
		return v.IsNil()
	}
	return false
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

type maskedError struct {
	err   error
	token string
}

func (m *maskedError) Error() string {
	return strings.ReplaceAll(m.err.Error(), m.token, "xxxx_masked_token")
}

func (m *maskedError) Unwrap() error {
	return m.err
}

func (c *BotAPIClient) sanitizeError(err error) error {
	if err == nil {
		return nil
	}
	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		redactedURL := urlErr.URL
		if c.token != "" {
			redactedURL = strings.ReplaceAll(urlErr.URL, c.token, "xxxx_masked_token")
		}
		return &url.Error{
			Op:  urlErr.Op,
			URL: redactedURL,
			Err: c.sanitizeError(urlErr.Err),
		}
	}
	errMsg := err.Error()
	if c.token != "" && strings.Contains(errMsg, c.token) {
		return errors.New(strings.ReplaceAll(errMsg, c.token, "xxxx_masked_token"))
	}
	return err
}

func (c *BotAPIClient) maskTokenInError(err error) error {
	if err == nil {
		return nil
	}
	sanitized := c.sanitizeError(err)
	if c.token != "" && (strings.Contains(err.Error(), c.token) || strings.Contains(sanitized.Error(), "xxxx_masked_token")) {
		return &maskedError{err: sanitized, token: c.token}
	}
	return sanitized
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

	var body []byte
	if !IsNil(payload) {
		var err error
		body, err = json.Marshal(payload)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal payload: %w", err)
		}
	}

	const maxRetries = 3
	skipNextBackoff := false

	for attempt := 0; attempt < maxRetries; attempt++ {
		var bodyReader io.Reader
		if body != nil {
			bodyReader = bytes.NewBuffer(body)
		}

		if attempt > 0 && !skipNextBackoff {
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
		skipNextBackoff = false

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bodyReader)
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
			return nil, fmt.Errorf("telegram api network error after %d attempts: %w", maxRetries, err)
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

		// Handle 429 Too Many Requests
		if result.ErrorCode == 429 {
			if result.Parameters != nil && result.Parameters.RetryAfter > 0 {
				retryAfter := time.Duration(result.Parameters.RetryAfter) * time.Second
				slog.Warn("Telegram rate limit hit, waiting retry_after",
					"method", method,
					"retry_after_seconds", result.Parameters.RetryAfter,
				)
				if attempt < maxRetries-1 {
					select {
					case <-ctx.Done():
						// Return 429 error instead of ctx.Err() so circuit breaker doesn't trip on context timeouts during rate limits
						return nil, &APIError{Code: 429, Message: fmt.Sprintf("rate limit hit, context cancelled while waiting: %v", ctx.Err())}
					case <-time.After(retryAfter):
					}
					skipNextBackoff = true
					continue
				}
			} else {
				slog.Warn("Telegram rate limit hit (no retry_after), will use exponential backoff", "method", method)
				if attempt < maxRetries-1 {
					continue
				}
			}
		}

		// Handle 5xx server errors — retryable
		if result.ErrorCode >= 500 && attempt < maxRetries-1 {
			continue
		}

		// Non-retryable error (4xx except 429)
		if result.ErrorCode == 401 {
			return nil, fmt.Errorf("%w: %s", ErrUnauthorized, result.Description)
		}
		if result.ErrorCode == 403 {
			return nil, fmt.Errorf("%w: %s", ErrForbidden, result.Description)
		}
		if result.ErrorCode == 404 {
			return nil, fmt.Errorf("%w: %s", ErrNotFound, result.Description)
		}
		if result.ErrorCode == 400 && strings.Contains(strings.ToLower(result.Description), "message to delete not found") {
			return nil, fmt.Errorf("%w: %s", ErrMessageNotFound, result.Description)
		}
		return nil, &APIError{Code: result.ErrorCode, Message: result.Description}
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

func (c *BotAPIClient) SendMessageWithResult(ctx context.Context, chatID int64, text string, replyToID *int, threadID *int, parseMode ...string) (*MessageResult, error) {
	mode := "HTML"
	if len(parseMode) > 0 {
		mode = parseMode[0]
	}
	payload := map[string]interface{}{
		"chat_id": chatID,
		"text":    text,
	}
	if mode != "" {
		payload["parse_mode"] = mode
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

func (c *BotAPIClient) DeclineChatJoinRequest(ctx context.Context, chatID interface{}, userID int64) error {
	_, err := c.Request(ctx, "declineChatJoinRequest", map[string]interface{}{
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
			"can_send_messages":         false,
			"can_send_audios":           false,
			"can_send_documents":        false,
			"can_send_photos":           false,
			"can_send_videos":           false,
			"can_send_video_notes":      false,
			"can_send_voice_notes":      false,
			"can_send_polls":            false,
			"can_send_other_messages":   false,
			"can_add_web_page_previews": false,
		},
		"use_independent_chat_permissions": true,
		"until_date":                       untilDate,
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

type TelegramChatMemberUser struct {
	ID        int64  `json:"id"`
	IsBot     bool   `json:"is_bot"`
	FirstName string `json:"first_name"`
	Username  string `json:"username,omitempty"`
	IsPremium bool   `json:"is_premium,omitempty"`
}

type TelegramChatMemberResponse struct {
	User   TelegramChatMemberUser `json:"user"`
	Status string                 `json:"status"`
}

func (c *BotAPIClient) GetChatMemberFull(ctx context.Context, chatID int64, userID int64) (*TelegramChatMemberResponse, error) {
	respBytes, err := c.Request(ctx, "getChatMember", map[string]interface{}{
		"chat_id": chatID,
		"user_id": userID,
	})
	if err != nil {
		return nil, err
	}
	var res TelegramChatMemberResponse
	if err := json.Unmarshal(respBytes, &res); err != nil {
		return nil, fmt.Errorf("failed to parse getChatMember result: %w", err)
	}
	return &res, nil
}


func (c *BotAPIClient) UnrestrictChatMember(ctx context.Context, chatID int64, userID int64) error {
	_, err := c.Request(ctx, "restrictChatMember", map[string]interface{}{
		"chat_id": chatID,
		"user_id": userID,
		"permissions": map[string]bool{
			"can_send_messages":         true,
			"can_send_media_messages":   true,
			"can_send_polls":            true,
			"can_send_other_messages":   true,
			"can_add_web_page_previews": true,
			"can_invite_users":          true,
			"can_pin_messages":          true,
		},
	})
	return err
}

func (c *BotAPIClient) PromoteChatMember(ctx context.Context, chatID int64, userID int64, perms map[string]bool) error {
	payload := map[string]interface{}{
		"chat_id": chatID,
		"user_id": userID,
	}
	for k, v := range perms {
		payload[k] = v
	}
	_, err := c.Request(ctx, "promoteChatMember", payload)
	return err
}

func (c *BotAPIClient) SetChatAdministratorCustomTitle(ctx context.Context, chatID int64, userID int64, title string) error {
	_, err := c.Request(ctx, "setChatAdministratorCustomTitle", map[string]interface{}{
		"chat_id":      chatID,
		"user_id":      userID,
		"custom_title": title,
	})
	return err
}

func (c *BotAPIClient) SendMessageWithMarkup(ctx context.Context, chatID int64, text string, markup interface{}, threadID *int, parseMode ...string) (*MessageResult, error) {
	mode := "HTML"
	if len(parseMode) > 0 {
		mode = parseMode[0]
	}
	payload := map[string]interface{}{
		"chat_id": chatID,
		"text":    text,
	}
	if !IsNil(markup) {
		payload["reply_markup"] = markup
	}
	if mode != "" {
		payload["parse_mode"] = mode
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

func (c *BotAPIClient) SendMessageWithReplyAndMarkup(ctx context.Context, chatID int64, text string, replyToID *int, markup interface{}, threadID *int, parseMode ...string) (*MessageResult, error) {
	mode := "HTML"
	if len(parseMode) > 0 {
		mode = parseMode[0]
	}
	payload := map[string]interface{}{
		"chat_id": chatID,
		"text":    text,
	}
	if !IsNil(markup) {
		payload["reply_markup"] = markup
	}
	if mode != "" {
		payload["parse_mode"] = mode
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

func (c *BotAPIClient) BaseURL() string {
	return c.baseURL
}

func (c *BotAPIClient) Token() string {
	return c.token
}

func (c *BotAPIClient) GetUserProfilePhotoURL(ctx context.Context, userID int64) (string, error) {
	resp, err := c.Request(ctx, "getUserProfilePhotos", map[string]interface{}{
		"user_id": userID,
		"limit":   1,
	})
	if err != nil {
		return "", err
	}

	var photosResult struct {
		TotalCount int `json:"total_count"`
		Photos     [][]struct {
			FileID string `json:"file_id"`
		} `json:"photos"`
	}
	if err := json.Unmarshal(resp, &photosResult); err != nil {
		return "", err
	}

	if photosResult.TotalCount == 0 || len(photosResult.Photos) == 0 || len(photosResult.Photos[0]) == 0 {
		return "", nil
	}

	sizes := photosResult.Photos[0]
	fileID := sizes[len(sizes)-1].FileID

	fileResp, err := c.Request(ctx, "getFile", map[string]interface{}{
		"file_id": fileID,
	})
	if err != nil {
		return "", err
	}

	var fileResult struct {
		FilePath string `json:"file_path"`
	}
	if err := json.Unmarshal(fileResp, &fileResult); err != nil {
		return "", err
	}

	return fileResult.FilePath, nil
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

type ChatPhoto struct {
	SmallFileID       string `json:"small_file_id"`
	SmallFileUniqueID string `json:"small_file_unique_id"`
	BigFileID         string `json:"big_file_id"`
	BigFileUniqueID   string `json:"big_file_unique_id"`
}

type ChatResult struct {
	ID          int64      `json:"id"`
	Type        string     `json:"type"`
	Title       string     `json:"title,omitempty"`
	Username    *string    `json:"username,omitempty"`
	Description string     `json:"description,omitempty"`
	Photo       *ChatPhoto `json:"photo,omitempty"`
}

type FileResult struct {
	FileID       string `json:"file_id"`
	FileUniqueID string `json:"file_unique_id"`
	FileSize     int    `json:"file_size,omitempty"`
	FilePath     string `json:"file_path,omitempty"`
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

// GetFile retrieves file info from Telegram
func (c *BotAPIClient) GetFile(ctx context.Context, fileID string) (*FileResult, error) {
	resp, err := c.Request(ctx, "getFile", map[string]interface{}{
		"file_id": fileID,
	})
	if err != nil {
		return nil, err
	}
	var res FileResult
	if err := json.Unmarshal(resp, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

// GetChatPhotoURL retrieves the direct download URL for a chat's profile photo
func (c *BotAPIClient) GetChatPhotoURL(ctx context.Context, chatID interface{}) (string, error) {
	chat, err := c.GetChat(ctx, chatID)
	if err != nil {
		return "", err
	}
	if chat.Photo == nil || chat.Photo.BigFileID == "" {
		return "", nil // No photo
	}

	fileRes, err := c.GetFile(ctx, chat.Photo.BigFileID)
	if err != nil {
		return "", err
	}

	if fileRes.FilePath == "" {
		return "", fmt.Errorf("file_path is empty")
	}

	// Construct the URL. The client struct needs the token, which it uses internally.
	// We can access c.token.
	url := fmt.Sprintf("https://api.telegram.org/file/bot%s/%s", c.token, fileRes.FilePath)
	return url, nil
}

// SetChatTitle sets a new title for the chat
func (c *BotAPIClient) SetChatTitle(ctx context.Context, chatID interface{}, title string) error {
	_, err := c.Request(ctx, "setChatTitle", map[string]interface{}{
		"chat_id": chatID,
		"title":   title,
	})
	return err
}

// SetChatDescription sets a new description for the chat
func (c *BotAPIClient) SetChatDescription(ctx context.Context, chatID interface{}, description string) error {
	_, err := c.Request(ctx, "setChatDescription", map[string]interface{}{
		"chat_id":     chatID,
		"description": description,
	})
	return err
}

// DeleteChatPhoto deletes the chat photo
func (c *BotAPIClient) DeleteChatPhoto(ctx context.Context, chatID interface{}) error {
	_, err := c.Request(ctx, "deleteChatPhoto", map[string]interface{}{
		"chat_id": chatID,
	})
	return err
}

// SetChatPhoto downloads a photo from URL and sets it as the chat profile photo
func (c *BotAPIClient) SetChatPhoto(ctx context.Context, chatID interface{}, photoURL string) error {
	// 1. Download the photo
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, photoURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create download request for photo: %w", err)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to download photo: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to download photo: status code %d", resp.StatusCode)
	}

	// 2. Prepare multipart/form-data
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add chat_id field
	chatIDStr := fmt.Sprintf("%v", chatID)
	_ = writer.WriteField("chat_id", chatIDStr)

	// Add photo field
	part, err := writer.CreateFormFile("photo", "photo.jpg")
	if err != nil {
		return fmt.Errorf("failed to create form file: %w", err)
	}

	if _, err = io.Copy(part, resp.Body); err != nil {
		return fmt.Errorf("failed to copy photo data: %w", err)
	}

	if err = writer.Close(); err != nil {
		return fmt.Errorf("failed to close multipart writer: %w", err)
	}

	// 3. Send to Telegram
	tgURL := fmt.Sprintf("%s/bot%s/setChatPhoto", c.baseURL, c.token)
	tgReq, err := http.NewRequestWithContext(ctx, http.MethodPost, tgURL, body)
	if err != nil {
		return fmt.Errorf("failed to create telegram request: %w", err)
	}
	tgReq.Header.Set("Content-Type", writer.FormDataContentType())

	tgResp, err := c.client.Do(tgReq)
	if err != nil {
		return c.maskTokenInError(fmt.Errorf("telegram setChatPhoto request failed: %w", err))
	}
	defer tgResp.Body.Close()

	var tgResult apiResponse
	if err := json.NewDecoder(tgResp.Body).Decode(&tgResult); err != nil {
		return c.maskTokenInError(fmt.Errorf("failed to decode setChatPhoto response: %w", err))
	}

	if !tgResult.OK {
		return c.maskTokenInError(fmt.Errorf("setChatPhoto failed: %s", tgResult.Description))
	}

	return nil
}

// ForwardMessage forwards a Telegram message from one chat to another
func (c *BotAPIClient) ForwardMessage(ctx context.Context, targetChatID interface{}, fromChatID int64, messageID int) error {
	_, err := c.Request(ctx, "forwardMessage", map[string]interface{}{
		"chat_id":      targetChatID,
		"from_chat_id": fromChatID,
		"message_id":   messageID,
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

// handleEditError ignores non-critical errors during message edits in channels.
func handleEditError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, ErrForbidden) {
		return nil
	}
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		if apiErr.Code == 429 {
			return nil
		}
		if apiErr.Code == 400 && strings.Contains(strings.ToLower(apiErr.Message), "message is not modified") {
			return nil
		}
	}
	return err
}

// LeaveChat makes the bot leave a group or channel
func (c *BotAPIClient) LeaveChat(ctx context.Context, chatID interface{}) error {
	_, err := c.Request(ctx, "leaveChat", map[string]interface{}{
		"chat_id": chatID,
	})
	return err
}

// EditMessageReplyMarkup edits the reply markup of a message
func (c *BotAPIClient) EditMessageReplyMarkup(ctx context.Context, chatID interface{}, messageID int, markup interface{}) error {
	payload := map[string]interface{}{
		"chat_id":    chatID,
		"message_id": messageID,
	}
	if !IsNil(markup) {
		payload["reply_markup"] = markup
	} else {
		payload["reply_markup"] = map[string]interface{}{
			"inline_keyboard": [][]interface{}{},
		}
	}
	_, err := c.Request(ctx, "editMessageReplyMarkup", payload)
	return handleEditError(err)
}

// EditMessageText edits the text of a message
func (c *BotAPIClient) EditMessageText(ctx context.Context, chatID interface{}, messageID int, text string, parseMode ...string) error {
	mode := "HTML"
	if len(parseMode) > 0 {
		mode = parseMode[0]
	}
	payload := map[string]interface{}{
		"chat_id":    chatID,
		"message_id": messageID,
		"text":       text,
	}
	if mode != "" {
		payload["parse_mode"] = mode
	}
	_, err := c.Request(ctx, "editMessageText", payload)
	return handleEditError(err)
}

// EditMessageTextWithMarkup edits both text and markup of a message
func (c *BotAPIClient) EditMessageTextWithMarkup(ctx context.Context, chatID interface{}, messageID int, text string, markup interface{}, parseMode ...string) error {
	mode := "HTML"
	if len(parseMode) > 0 {
		mode = parseMode[0]
	}
	payload := map[string]interface{}{
		"chat_id":    chatID,
		"message_id": messageID,
		"text":       text,
	}
	if mode != "" {
		payload["parse_mode"] = mode
	}
	if !IsNil(markup) {
		payload["reply_markup"] = markup
	}
	_, err := c.Request(ctx, "editMessageText", payload)
	return handleEditError(err)
}

// EditMessageCaptionWithMarkup edits the caption of a media message
func (c *BotAPIClient) EditMessageCaptionWithMarkup(ctx context.Context, chatID interface{}, messageID int, caption string, markup interface{}) error {
	payload := map[string]interface{}{
		"chat_id":    chatID,
		"message_id": messageID,
		"caption":    caption,
	}
	if !IsNil(markup) {
		payload["reply_markup"] = markup
	}
	_, err := c.Request(ctx, "editMessageCaption", payload)
	return handleEditError(err)
}

// CopyMessage copies messages of any kind
func (c *BotAPIClient) CopyMessage(ctx context.Context, targetChatID interface{}, fromChatID interface{}, messageID int, markup interface{}) error {
	payload := map[string]interface{}{
		"chat_id":      targetChatID,
		"from_chat_id": fromChatID,
		"message_id":   messageID,
	}
	if !IsNil(markup) {
		payload["reply_markup"] = markup
	}
	_, err := c.Request(ctx, "copyMessage", payload)
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

// SendPhoto sends a photo by URL or file_id
func (c *BotAPIClient) SendPhoto(ctx context.Context, chatID int64, photoURL string, caption string, parseMode ...string) (*MessageResult, error) {
	mode := "HTML"
	if len(parseMode) > 0 {
		mode = parseMode[0]
	}
	payload := map[string]interface{}{
		"chat_id": chatID,
		"photo":   photoURL,
	}
	if caption != "" {
		payload["caption"] = caption
	}
	if mode != "" {
		payload["parse_mode"] = mode
	}

	resp, err := c.doRequestWithRetry(ctx, "sendPhoto", payload)
	if err != nil {
		return nil, err
	}

	var msgResult struct {
		Result MessageResult `json:"result"`
	}
	if err := json.Unmarshal(resp, &msgResult); err != nil {
		return nil, err
	}
	return &msgResult.Result, nil
}

// FlexibleString handles unmarshaling JSON values that can be either numbers or strings.
type FlexibleString string

func (fs *FlexibleString) UnmarshalJSON(b []byte) error {
	if len(b) == 0 || string(b) == "null" {
		*fs = ""
		return nil
	}
	var s string
	if err := json.Unmarshal(b, &s); err == nil {
		*fs = FlexibleString(s)
		return nil
	}
	var i int64
	if err := json.Unmarshal(b, &i); err == nil {
		*fs = FlexibleString(strconv.FormatInt(i, 10))
		return nil
	}
	var f float64
	if err := json.Unmarshal(b, &f); err == nil {
		*fs = FlexibleString(strconv.FormatFloat(f, 'f', -1, 64))
		return nil
	}
	*fs = FlexibleString(string(b))
	return nil
}

func (fs FlexibleString) String() string {
	return string(fs)
}

type EphemeralMessageResult struct {
	MessageID          int            `json:"message_id"`
	EphemeralMessageID FlexibleString `json:"ephemeral_message_id"`
}

// SendEphemeralMessage sends a text message visible only to a specific user in a group chat.
func (c *BotAPIClient) SendEphemeralMessage(ctx context.Context, chatID int64, receiverUserID int64, text string, threadID *int, parseMode ...string) (*EphemeralMessageResult, error) {
	mode := "HTML"
	if len(parseMode) > 0 {
		mode = parseMode[0]
	}
	payload := map[string]interface{}{
		"chat_id":          chatID,
		"receiver_user_id": receiverUserID,
		"text":             text,
	}
	if mode != "" {
		payload["parse_mode"] = mode
	}
	if threadID != nil {
		payload["message_thread_id"] = *threadID
	}
	resp, err := c.Request(ctx, "sendMessage", payload)
	if err != nil {
		return nil, err
	}
	var res EphemeralMessageResult
	if err := json.Unmarshal(resp, &res); err != nil {
		return nil, fmt.Errorf("failed to parse ephemeral message result: %w", err)
	}
	if string(res.EphemeralMessageID) == "" && res.MessageID != 0 {
		res.EphemeralMessageID = FlexibleString(fmt.Sprintf("%d", res.MessageID))
	}
	return &res, nil
}

// SendEphemeralMessageWithMarkup sends a text message with inline markup visible only to a specific user in a group chat.
func (c *BotAPIClient) SendEphemeralMessageWithMarkup(ctx context.Context, chatID int64, receiverUserID int64, text string, markup interface{}, threadID *int, parseMode ...string) (*EphemeralMessageResult, error) {
	mode := "HTML"
	if len(parseMode) > 0 {
		mode = parseMode[0]
	}
	payload := map[string]interface{}{
		"chat_id":          chatID,
		"receiver_user_id": receiverUserID,
		"text":             text,
	}
	if !IsNil(markup) {
		payload["reply_markup"] = markup
	}
	if mode != "" {
		payload["parse_mode"] = mode
	}
	if threadID != nil {
		payload["message_thread_id"] = *threadID
	}
	resp, err := c.Request(ctx, "sendMessage", payload)
	if err != nil {
		return nil, err
	}
	var res EphemeralMessageResult
	if err := json.Unmarshal(resp, &res); err != nil {
		return nil, fmt.Errorf("failed to parse ephemeral message result with markup: %w", err)
	}
	if string(res.EphemeralMessageID) == "" && res.MessageID != 0 {
		res.EphemeralMessageID = FlexibleString(fmt.Sprintf("%d", res.MessageID))
	}
	return &res, nil
}

// EditEphemeralMessageText edits the text of an ephemeral message.
func (c *BotAPIClient) EditEphemeralMessageText(ctx context.Context, chatID interface{}, ephemeralMessageID string, text string, parseMode ...string) error {
	mode := "HTML"
	if len(parseMode) > 0 {
		mode = parseMode[0]
	}
	payload := map[string]interface{}{
		"chat_id":              chatID,
		"ephemeral_message_id": ephemeralMessageID,
		"text":                 text,
	}
	if mode != "" {
		payload["parse_mode"] = mode
	}
	_, err := c.Request(ctx, "editEphemeralMessageText", payload)
	return handleEditError(err)
}

// DeleteEphemeralMessage deletes an ephemeral message.
func (c *BotAPIClient) DeleteEphemeralMessage(ctx context.Context, chatID interface{}, ephemeralMessageID string, receiverUserID ...int64) error {
	if ephemeralMessageID == "" {
		return nil
	}
	var epID interface{} = ephemeralMessageID
	if num, err := strconv.ParseInt(ephemeralMessageID, 10, 64); err == nil {
		epID = num
	}
	payload := map[string]interface{}{
		"chat_id":              chatID,
		"ephemeral_message_id": epID,
	}
	if len(receiverUserID) > 0 && receiverUserID[0] != 0 {
		payload["receiver_user_id"] = receiverUserID[0]
		payload["user_id"] = receiverUserID[0]
	}
	_, err := c.Request(ctx, "deleteEphemeralMessage", payload)
	if err != nil {
		if num, ok := epID.(int64); ok && num > 0 {
			delPayload := map[string]interface{}{
				"chat_id":    chatID,
				"message_id": num,
			}
			if len(receiverUserID) > 0 && receiverUserID[0] != 0 {
				delPayload["receiver_user_id"] = receiverUserID[0]
				delPayload["user_id"] = receiverUserID[0]
			}
			_, errFallback := c.Request(ctx, "deleteMessage", delPayload)
			if errFallback == nil {
				return nil
			}
		}
	}
	return err
}

// ChatPermissions describes actions that a non-administrator user is allowed to take in a chat.
type ChatPermissions struct {
	CanSendMessages       bool `json:"can_send_messages"`
	CanSendAudios         bool `json:"can_send_audios"`
	CanSendDocuments      bool `json:"can_send_documents"`
	CanSendPhotos         bool `json:"can_send_photos"`
	CanSendVideos         bool `json:"can_send_videos"`
	CanSendVideoNotes     bool `json:"can_send_video_notes"`
	CanSendVoiceNotes     bool `json:"can_send_voice_notes"`
	CanSendPolls          bool `json:"can_send_polls"`
	CanSendOtherMessages  bool `json:"can_send_other_messages"`
	CanAddWebPagePreviews bool `json:"can_add_web_page_previews"`
	CanChangeInfo         bool `json:"can_change_info"`
	CanInviteUsers        bool `json:"can_invite_users"`
	CanPinMessages        bool `json:"can_pin_messages"`
	CanManageTopics       bool `json:"can_manage_topics"`
}

// SetChatPermissions sets default chat permissions for all members
func (c *BotAPIClient) SetChatPermissions(ctx context.Context, chatID interface{}, permissions ChatPermissions) error {
	payload := map[string]interface{}{
		"chat_id":     chatID,
		"permissions": permissions,
	}
	_, err := c.Request(ctx, "setChatPermissions", payload)
	return err
}

// SetChatSlowModeDelay sets slow mode delay in seconds for a supergroup (0 to disable)
func (c *BotAPIClient) SetChatSlowModeDelay(ctx context.Context, chatID interface{}, slowModeDelay int) error {
	payload := map[string]interface{}{
		"chat_id":         chatID,
		"slow_mode_delay": slowModeDelay,
	}
	_, err := c.Request(ctx, "setChatSlowModeDelay", payload)
	return err
}

// DeleteMessages deletes multiple messages simultaneously (Telegram Bot API 7.0+)
func (c *BotAPIClient) DeleteMessages(ctx context.Context, chatID interface{}, messageIDs []int) error {
	if len(messageIDs) == 0 {
		return nil
	}
	payload := map[string]interface{}{
		"chat_id":     chatID,
		"message_ids": messageIDs,
	}
	_, err := c.Request(ctx, "deleteMessages", payload)
	if err != nil {
		var cID int64
		switch v := chatID.(type) {
		case int64:
			cID = v
		case int:
			cID = int64(v)
		case float64:
			cID = int64(v)
		}
		if cID != 0 {
			for _, mID := range messageIDs {
				_ = c.DeleteMessage(ctx, cID, mID)
			}
		}
	}
	return nil
}
