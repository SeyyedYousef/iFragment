package channelmgmt

import (
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"log/slog"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
)

type AutoResponderService struct {
	channelRepo *repository.ChannelRepo
}

func NewAutoResponderService(channelRepo *repository.ChannelRepo) *AutoResponderService {
	return &AutoResponderService{
		channelRepo: channelRepo,
	}
}

// ProcessMessage evaluates a message against the auto-responder rules for a channel.
// Returns true if an auto-response was triggered and sent.
func (s *AutoResponderService) ProcessMessage(ctx context.Context, tg *telegram.BotAPIClient, channelID uuid.UUID, chatID int64, messageID int, text string) (bool, error) {
	if text == "" {
		return false, nil
	}

	settings, err := s.channelRepo.GetChannelSettings(ctx, channelID)
	if err != nil || settings == nil {
		return false, err
	}

	if len(settings.AutoResponder) == 0 {
		return false, nil
	}

	var schema AutoResponderSchema
	if err := json.Unmarshal(settings.AutoResponder, &schema); err != nil {
		return false, fmt.Errorf("failed to parse auto responder settings: %w", err)
	}

	if !schema.Enabled {
		return false, nil
	}

	textLower := strings.ToLower(text)

	for _, rule := range schema.Rules {
		if rule.Enabled != nil && !*rule.Enabled {
			continue
		}

		matched := false

		switch rule.Match {
		case "exact":
			matched = strings.ToLower(rule.Keys) == textLower
		case "contains":
			keys := strings.Split(rule.Keys, ",")
			for _, key := range keys {
				if strings.Contains(textLower, strings.ToLower(strings.TrimSpace(key))) {
					matched = true
					break
				}
			}
		case "regex":
			re, err := regexp.Compile("(?i)" + rule.Keys)
			if err == nil && re.MatchString(text) {
				matched = true
			}
		case "keyword":
			pattern := `(?i)(^|[\s\p{P}])` + regexp.QuoteMeta(rule.Keys) + `([\s\p{P}]|$)`
			if re, err := regexp.Compile(pattern); err == nil {
				if re.MatchString(text) {
					matched = true
				}
			}
		}

		if matched {
			replyText := rule.ReplyText
			if replyText == "" {
				replyText = rule.Response // fallback if schema has 'response' instead of 'replyText'
			}

			if replyText != "" {
				// Rate limiting to prevent spam triggers
				if cache := s.channelRepo.GetCache(); cache != nil && cache.Client != nil {
					rlKey := fmt.Sprintf("auto_responder_rl:%d", chatID)
					count, _ := cache.Client.Incr(ctx, rlKey).Result()
					if count == 1 {
						cache.Client.Expire(ctx, rlKey, 1*time.Minute)
					}
					if count > 5 {
						slog.Warn("Auto-Responder rate limit exceeded", "chat_id", chatID)
						return false, nil
					}
				}

				// Send the reply
				res, err := tg.SendMessageWithResult(ctx, chatID, replyText, nil, &messageID)
				if err != nil {
					slog.Error("failed to send auto response", "error", err, "chat_id", chatID, "message_id", messageID)
				} else if res != nil {
					// Handle Auto Delete
					var general map[string]interface{}
					if json.Unmarshal(settings.General, &general) == nil {
						if autoDeleteBot, ok := general["autoDeleteBot"].(bool); ok && autoDeleteBot {
							if autoDeleteDelay, ok := general["autoDeleteDelay"].(float64); ok && autoDeleteDelay > 0 {
								time.AfterFunc(time.Duration(autoDeleteDelay)*time.Second, func() {
									_ = tg.DeleteMessage(context.Background(), chatID, res.MessageID)
								})
							}
						}
					}
				}
				return true, nil
			}
		}
	}

	return false, nil
}
