package payment

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type StarsService struct {
	BotToken string
	HTTP     *http.Client
}

func NewStarsService() *StarsService {
	return &StarsService{
		BotToken: os.Getenv("BOT_TOKEN"),
		HTTP:     &http.Client{},
	}
}

type InvoiceRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Payload     string `json:"payload"`
	Currency    string `json:"currency"` // Must be "XTR" for Stars
	Prices      []Price `json:"prices"`
}

type Price struct {
	Label  string `json:"label"`
	Amount int    `json:"amount"` // In Stars
}

type InvoiceResponse struct {
	OK     bool   `json:"ok"`
	Result string `json:"result"` // The invoice link
}

func (s *StarsService) CreateInvoiceLink(title, desc, payload string, amount int) (string, error) {
	url := fmt.Sprintf("https://api.telegram.org/bot%s/createInvoiceLink", s.BotToken)

	reqBody := InvoiceRequest{
		Title:       title,
		Description: desc,
		Payload:     payload,
		Currency:    "XTR",
		Prices:      []Price{{Label: title, Amount: amount}},
	}

	jsonBody, _ := json.Marshal(reqBody)
	resp, err := s.HTTP.Post(url, "application/json", bytes.NewBuffer(jsonBody))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result InvoiceResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	if !result.OK {
		return "", fmt.Errorf("telegram error: %v", result)
	}

	return result.Result, nil
}
