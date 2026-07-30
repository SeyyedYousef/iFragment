package channelmgmt

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

// ─── Provider Registry ───────────────────────────────────────

type LLMProvider struct {
	ID           string   `json:"id"`
	BaseURL      string   `json:"baseUrl"` // OpenAI-compatible chat/completions or Anthropic endpoint
	DefaultModel string   `json:"defaultModel"`
	AuthStyle    string   `json:"authStyle"` // "bearer" | "anthropic"
	KeyPrefixes  []string `json:"keyPrefixes"`
}

var llmProviders = map[string]LLMProvider{
	"gemini": {
		ID:           "gemini",
		BaseURL:      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
		DefaultModel: "gemini-2.5-flash",
		AuthStyle:    "bearer",
		KeyPrefixes:  []string{"AIza"},
	},
	"openai": {
		ID:           "openai",
		BaseURL:      "https://api.openai.com/v1/chat/completions",
		DefaultModel: "gpt-4o-mini",
		AuthStyle:    "bearer",
		KeyPrefixes:  []string{"sk-proj-", "sk-"},
	},
	"anthropic": {
		ID:           "anthropic",
		BaseURL:      "https://api.anthropic.com/v1/messages",
		DefaultModel: "claude-3-5-haiku-latest",
		AuthStyle:    "anthropic",
		KeyPrefixes:  []string{"sk-ant-"},
	},
	"groq": {
		ID:           "groq",
		BaseURL:      "https://api.groq.com/openai/v1/chat/completions",
		DefaultModel: "llama-3.3-70b-versatile",
		AuthStyle:    "bearer",
		KeyPrefixes:  []string{"gsk_"},
	},
	"xai": { // Grok
		ID:           "xai",
		BaseURL:      "https://api.x.ai/v1/chat/completions",
		DefaultModel: "grok-3-mini",
		AuthStyle:    "bearer",
		KeyPrefixes:  []string{"xai-"},
	},
	"kimi": { // Moonshot
		ID:           "kimi",
		BaseURL:      "https://api.moonshot.ai/v1/chat/completions",
		DefaultModel: "kimi-k2-turbo-preview",
		AuthStyle:    "bearer",
		KeyPrefixes:  []string{"sk-mk-"},
	},
	"deepseek": {
		ID:           "deepseek",
		BaseURL:      "https://api.deepseek.com/chat/completions",
		DefaultModel: "deepseek-chat",
		AuthStyle:    "bearer",
		KeyPrefixes:  []string{"sk-"},
	},
	"openrouter": {
		ID:           "openrouter",
		BaseURL:      "https://openrouter.ai/api/v1/chat/completions",
		DefaultModel: "google/gemini-2.5-flash",
		AuthStyle:    "bearer",
		KeyPrefixes:  []string{"sk-or-"},
	},
	"mistral": {
		ID:           "mistral",
		BaseURL:      "https://api.mistral.ai/v1/chat/completions",
		DefaultModel: "mistral-small-latest",
		AuthStyle:    "bearer",
		KeyPrefixes:  []string{},
	},
}

// ResolveProvider selects the provider using explicit providerID, matching key prefix, or defaults to Gemini.
func ResolveProvider(providerID, apiKey string) LLMProvider {
	cleanID := strings.ToLower(strings.TrimSpace(providerID))
	if p, ok := llmProviders[cleanID]; ok {
		return p
	}

	best, bestLen := LLMProvider{}, 0
	for _, p := range llmProviders {
		for _, pre := range p.KeyPrefixes {
			if strings.HasPrefix(apiKey, pre) && len(pre) > bestLen {
				best, bestLen = p, len(pre)
			}
		}
	}
	if bestLen > 0 {
		return best
	}
	return llmProviders["gemini"]
}

// ─── Unified Chat Call ───────────────────────────────────────

// CallLLM sends system+user messages to any provider and returns raw text.
func CallLLM(ctx context.Context, providerID, apiKey, model, systemPrompt, userMsg string, jsonMode bool) (string, error) {
	apiKey = strings.TrimSpace(apiKey)
	if apiKey == "" {
		return "", fmt.Errorf("API key is required")
	}

	p := ResolveProvider(providerID, apiKey)
	if strings.TrimSpace(model) == "" {
		model = p.DefaultModel
	}

	var payload map[string]interface{}
	if p.AuthStyle == "anthropic" {
		messages := []map[string]string{
			{"role": "user", "content": userMsg},
		}
		payload = map[string]interface{}{
			"model":      model,
			"max_tokens": 2048,
			"messages":   messages,
		}
		if strings.TrimSpace(systemPrompt) != "" {
			payload["system"] = systemPrompt
		}
	} else {
		messages := make([]map[string]string, 0, 2)
		if strings.TrimSpace(systemPrompt) != "" {
			messages = append(messages, map[string]string{"role": "system", "content": systemPrompt})
		}
		messages = append(messages, map[string]string{"role": "user", "content": userMsg})

		payload = map[string]interface{}{
			"model":       model,
			"messages":    messages,
			"temperature": 0.7,
			"max_tokens":  2048,
		}
		if jsonMode {
			payload["response_format"] = map[string]string{"type": "json_object"}
		}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal LLM request payload: %w", err)
	}

	client := &http.Client{Timeout: 45 * time.Second}
	var lastErr error

	for attempt := 1; attempt <= 3; attempt++ {
		req, err := http.NewRequestWithContext(ctx, "POST", p.BaseURL, bytes.NewReader(body))
		if err != nil {
			return "", err
		}
		req.Header.Set("Content-Type", "application/json")
		if p.AuthStyle == "anthropic" {
			req.Header.Set("x-api-key", apiKey)
			req.Header.Set("anthropic-version", "2023-06-01")
		} else {
			req.Header.Set("Authorization", "Bearer "+apiKey)
		}

		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
		} else {
			respBody, _ := io.ReadAll(resp.Body)
			resp.Body.Close()

			if resp.StatusCode == http.StatusOK {
				return extractLLMText(p, respBody)
			}
			lastErr = fmt.Errorf("%s API status %d: %s", p.ID, resp.StatusCode, truncateString(string(respBody), 300))
			// Do not retry client non-transient errors (e.g., 400 Bad Request, 401 Unauthorized, 403 Forbidden)
			if resp.StatusCode != http.StatusTooManyRequests && resp.StatusCode < 500 {
				return "", lastErr
			}
		}
		if attempt < 3 {
			slog.Warn("Retrying LLM call due to transient error", "provider", p.ID, "attempt", attempt, "error", lastErr)
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(time.Duration(attempt) * time.Second):
			}
		}
	}
	return "", lastErr
}

func extractLLMText(p LLMProvider, body []byte) (string, error) {
	if p.AuthStyle == "anthropic" {
		var r struct {
			Content []struct {
				Text string `json:"text"`
			} `json:"content"`
		}
		if err := json.Unmarshal(body, &r); err != nil || len(r.Content) == 0 {
			return "", fmt.Errorf("failed to parse %s response: %w", p.ID, err)
		}
		return strings.TrimSpace(r.Content[0].Text), nil
	}

	var r struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(body, &r); err != nil || len(r.Choices) == 0 {
		return "", fmt.Errorf("failed to parse %s response: %w", p.ID, err)
	}
	return strings.TrimSpace(r.Choices[0].Message.Content), nil
}

func truncateString(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
