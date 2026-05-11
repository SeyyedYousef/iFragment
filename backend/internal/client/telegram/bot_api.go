package telegram

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type BotAPIClient struct {
	token  string
	client *http.Client
}

func NewBotAPIClient(token string) *BotAPIClient {
	return &BotAPIClient{
		token: token,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *BotAPIClient) request(method string, payload interface{}) (json.RawMessage, error) {
	url := fmt.Sprintf("https://api.telegram.org/bot%s/%s", c.token, method)
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

func (c *BotAPIClient) SendMessage(chatID int64, text string, replyToID *int) error {
	payload := map[string]interface{}{
		"chat_id": chatID,
		"text":    text,
	}
	if replyToID != nil {
		payload["reply_to_message_id"] = *replyToID
	}
	_, err := c.request("sendMessage", payload)
	return err
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
