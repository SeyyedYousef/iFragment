package laya

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	DefaultBaseURL = "http://localhost:8000/v1/systemone"
	DefaultModel   = "convai/laya-multilingual"
)

// Client handles communication with the Laya System 1 (Convai Innovations) decision engine.
type Client struct {
	BaseURL    string
	APIKey     string
	Model      string
	HTTP       *http.Client
	MockClient *MockEvaluator
}

// NewClient creates a new Laya client with environment auto-detection.
func NewClient() *Client {
	apiKey := strings.TrimSpace(os.Getenv("LAYA_API_KEY"))
	baseURL := strings.TrimSpace(os.Getenv("LAYA_BASE_URL"))
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	model := strings.TrimSpace(os.Getenv("LAYA_MODEL"))
	if model == "" {
		model = DefaultModel
	}

	c := &Client{
		BaseURL: baseURL,
		APIKey:  apiKey,
		Model:   model,
		HTTP: &http.Client{
			Timeout: 3 * time.Second, // Laya targets sub-40ms inference
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 20,
				IdleConnTimeout:     90 * time.Second,
			},
		},
		MockClient: NewMockEvaluator(),
	}

	slog.Info("Laya System 1 client initialized (Open-Source / Convai)", "model", model, "base_url", baseURL)
	return c
}

// Evaluate sends a System 1 decision request to Laya.
// If the Laya local endpoint is not reachable or returns an error, it gracefully falls back to MockEvaluator.
func (c *Client) Evaluate(ctx context.Context, state any, questions map[string]Question) (*Response, error) {
	reqBody := Request{
		Model:     c.Model,
		State:     state,
		Questions: questions,
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal laya request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("failed to create http request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if c.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.APIKey)
	}
	req.Header.Set("User-Agent", "iFragment-Go/1.0 (SystemOne; Laya)")

	resp, err := c.HTTP.Do(req)
	if err != nil {
		// If Laya server is offline, fallback immediately without failing the caller
		return c.MockClient.Evaluate(ctx, state, questions)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.MockClient.Evaluate(ctx, state, questions)
	}

	if resp.StatusCode != http.StatusOK {
		return c.MockClient.Evaluate(ctx, state, questions)
	}

	var apiResp Response
	if err := json.Unmarshal(bodyBytes, &apiResp); err != nil {
		return c.MockClient.Evaluate(ctx, state, questions)
	}

	return &apiResp, nil
}
