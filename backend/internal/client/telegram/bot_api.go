package telegram

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type BotAPIClient struct {
	token   string
	client  *http.Client
	baseURL string
}

func NewBotAPIClient(token string) *BotAPIClient {
	baseURL := os.Getenv("TELEGRAM_API_URL")
	if baseURL == "" {
		baseURL = "https://api.telegram.org"
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
	}
}

func (c *BotAPIClient) request(method string, payload interface{}) (json.RawMessage, error) {
	url := fmt.Sprintf("%s/bot%s/%s", c.baseURL, c.token, method)
	body, _ := json.Marshal(payload)
	
	resp, err := c.client.Post(url, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		OK          bool            `json:"ok"`
		Result      json.RawMessage `json:"result"`
		Description string          `json:"description"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if !result.OK {
		return nil, fmt.Errorf("telegram api error: %s", result.Description)
	}

	return result.Result, nil
}

func (c *BotAPIClient) DeleteMessage(chatID int64, messageID int) error {
	_, err := c.request("deleteMessage", map[string]interface{}{
		"chat_id":    chatID,
		"message_id": messageID,
	})
	return err
}

func (c *BotAPIClient) SendMessage(chatID int64, text string, replyToID *int, threadID *int) error {
	_, err := c.SendMessageWithResult(chatID, text, replyToID, threadID)
	return err
}

type MessageResult struct {
	MessageID int `json:"message_id"`
}

func (c *BotAPIClient) SendMessageWithResult(chatID int64, text string, replyToID *int, threadID *int) (*MessageResult, error) {
	payload := map[string]interface{}{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "Markdown",
	}
	if replyToID != nil {
		payload["reply_to_message_id"] = *replyToID
	}
	if threadID != nil {
		payload["message_thread_id"] = *threadID
	}
	resp, err := c.request("sendMessage", payload)
	if err != nil {
		return nil, err
	}
	var res MessageResult
	json.Unmarshal(resp, &res)
	return &res, nil
}

func (c *BotAPIClient) GetChatMember(chatID interface{}, userID int64) (string, error) {
	resp, err := c.request("getChatMember", map[string]interface{}{
		"chat_id": chatID,
		"user_id": userID,
	})
	if err != nil {
		return "", err
	}
	var member struct {
		Status string `json:"status"`
	}
	json.Unmarshal(resp, &member)
	return member.Status, nil
}

func (c *BotAPIClient) RestrictChatMember(chatID int64, userID int64, untilDate int64) error {
	_, err := c.request("restrictChatMember", map[string]interface{}{
		"chat_id": chatID,
		"user_id": userID,
		"permissions": map[string]bool{
			"can_send_messages": false,
		},
		"until_date": untilDate,
	})
	return err
}

func (c *BotAPIClient) BanChatMember(chatID int64, userID int64, untilDate int64, revokeMessages bool) error {
	_, err := c.request("banChatMember", map[string]interface{}{
		"chat_id":         chatID,
		"user_id":         userID,
		"until_date":      untilDate,
		"revoke_messages": revokeMessages,
	})
	return err
}

func (c *BotAPIClient) UnbanChatMember(chatID int64, userID int64, onlyIfBanned bool) error {
	_, err := c.request("unbanChatMember", map[string]interface{}{
		"chat_id":        chatID,
		"user_id":        userID,
		"only_if_banned": onlyIfBanned,
	})
	return err
}
func (c *BotAPIClient) UnrestrictChatMember(chatID int64, userID int64) error {
	_, err := c.request("restrictChatMember", map[string]interface{}{
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

func (c *BotAPIClient) SendMessageWithMarkup(chatID int64, text string, markup interface{}, threadID *int) (*MessageResult, error) {
	payload := map[string]interface{}{
		"chat_id":      chatID,
		"text":         text,
		"parse_mode":   "Markdown",
		"reply_markup": markup,
	}
	if threadID != nil {
		payload["message_thread_id"] = *threadID
	}
	resp, err := c.request("sendMessage", payload)
	if err != nil {
		return nil, err
	}
	var res MessageResult
	json.Unmarshal(resp, &res)
	return &res, nil
}

func (c *BotAPIClient) AnswerCallbackQuery(queryID string, text string, showAlert bool) error {
	_, err := c.request("answerCallbackQuery", map[string]interface{}{
		"callback_query_id": queryID,
		"text":              text,
		"show_alert":        showAlert,
	})
	return err
}

func (c *BotAPIClient) PinChatMessage(chatID int64, messageID int) error {
	_, err := c.request("pinChatMessage", map[string]interface{}{
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

func (c *BotAPIClient) GetMe() (*User, error) {
	resp, err := c.request("getMe", nil)
	if err != nil {
		return nil, err
	}
	var me User
	if err := json.Unmarshal(resp, &me); err != nil {
		return nil, err
	}
	return &me, nil
}

func (c *BotAPIClient) GetChatMemberCount(chatID interface{}) (int, error) {
	resp, err := c.request("getChatMemberCount", map[string]interface{}{
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

func (c *BotAPIClient) GetChat(chatID interface{}) (*ChatResult, error) {
	resp, err := c.request("getChat", map[string]interface{}{
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

