package channelmgmt

import (
	"context"
	"encoding/json"
	"fmt"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"log/slog"
	"os"
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

// resolveChannelLLMCredentials gets LLM provider, API key, and model from channel settings or environment
func (s *AutoResponderService) resolveChannelLLMCredentials(ctx context.Context, channelID uuid.UUID) (provider, apiKey, model string) {
	settings, err := s.channelRepo.GetChannelSettings(ctx, channelID)
	if err == nil && settings != nil && len(settings.Posting) > 0 {
		var posting PostingSettingsSchema
		if json.Unmarshal(settings.Posting, &posting) == nil {
			provider = posting.AiProvider
			apiKey = posting.ApiKey
			model = posting.AiModel
		}
	}
	if apiKey == "" {
		apiKey = os.Getenv("GROQ_API_KEY")
		if apiKey != "" {
			provider = "groq"
		} else {
			apiKey = os.Getenv("GEMINI_API_KEY")
			if apiKey != "" {
				provider = "gemini"
			}
		}
	}
	return
}

// generateAIComment produces a context-aware comment for a channel post
func (s *AutoResponderService) generateAIComment(ctx context.Context, channelID uuid.UUID, postText string) (string, error) {
	provider, apiKey, model := s.resolveChannelLLMCredentials(ctx, channelID)
	if apiKey == "" {
		return "", fmt.Errorf("no LLM API key configured for AI comment")
	}

	systemPrompt := "You are an AI assistant for a Telegram channel. Your job is to write a short, highly relevant, engaging first comment for the channel post provided inside <POST> tags.\n" +
		"HARD RULES:\n" +
		"1. Respond in the EXACT same language as the post (e.g. Persian if post is in Persian).\n" +
		"2. Keep it concise (1 to 2 sentences max).\n" +
		"3. Sound natural, positive, and human.\n" +
		"4. Return ONLY the comment text without code fences, quotes, or preambles."

	userMsg := fmt.Sprintf("<POST>\n%s\n</POST>", postText)
	return CallLLM(ctx, provider, apiKey, model, systemPrompt, userMsg, false)
}

// generateAIResponse produces a context-aware auto-response to a message
func (s *AutoResponderService) generateAIResponse(ctx context.Context, channelID uuid.UUID, userText string, instruction string) (string, error) {
	provider, apiKey, model := s.resolveChannelLLMCredentials(ctx, channelID)
	if apiKey == "" {
		return "", fmt.Errorf("no LLM API key configured for AI response")
	}

	systemPrompt := "You are an AI auto-responder for a Telegram group/channel. Read the incoming message inside <USER_MESSAGE> tags and generate a helpful, polite, and direct response.\n"
	if strings.TrimSpace(instruction) != "" {
		systemPrompt += fmt.Sprintf("Additional instructions from admin: %s\n", instruction)
	}
	systemPrompt += "HARD RULES:\n" +
		"1. Respond in the EXACT same language as the incoming message.\n" +
		"2. Keep it concise and clear.\n" +
		"3. Output ONLY the response text without code fences or preambles."

	userMsg := fmt.Sprintf("<USER_MESSAGE>\n%s\n</USER_MESSAGE>", userText)
	return CallLLM(ctx, provider, apiKey, model, systemPrompt, userMsg, false)
}

// getAutoResponderMarkup returns the inline keyboard markup based on attachButton preset or channel buttons
func (s *AutoResponderService) getAutoResponderMarkup(ctx context.Context, channelID uuid.UUID, attachButton string) interface{} {
	switch strings.TrimSpace(attachButton) {
	case "like_set":
		buttons := []repository.ChannelInlineButton{
			{ID: uuid.New(), ChannelID: channelID, Title: "👍", Type: "callback", Value: "like"},
			{ID: uuid.New(), ChannelID: channelID, Title: "👎", Type: "callback", Value: "dislike"},
		}
		return BuildInlineKeyboard(buttons)
	case "share_set":
		buttons := []repository.ChannelInlineButton{
			{ID: uuid.New(), ChannelID: channelID, Emoji: "📢", Title: "اشتراک‌گذاری", Type: "share", Value: "share"},
		}
		return BuildInlineKeyboard(buttons)
	default:
		buttons, err := s.channelRepo.GetChannelButtons(ctx, channelID)
		if err == nil && len(buttons) > 0 {
			return BuildInlineKeyboard(buttons)
		}
	}
	return nil
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
		case "ai":
			matched = true
		}

		if matched {
			replyText := rule.ReplyText
			if replyText == "" {
				replyText = rule.Response // fallback if schema has 'response' instead of 'replyText'
			}

			if rule.UseAI || rule.Match == "ai" {
				aiReply, err := s.generateAIResponse(ctx, channelID, text, replyText)
				if err == nil && strings.TrimSpace(aiReply) != "" {
					replyText = aiReply
				}
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

				// Send the reply with inline keyboard markup if configured
				markup := s.getAutoResponderMarkup(ctx, channelID, schema.AttachButton)
				res, err := tg.SendMessageWithReplyAndMarkup(ctx, chatID, replyText, &messageID, markup, nil)
				if err != nil {
					slog.Error("failed to send auto response", "error", err, "chat_id", chatID, "message_id", messageID)
				} else if res != nil {
					// Handle Auto Delete
					var general map[string]interface{}
					if json.Unmarshal(settings.General, &general) == nil {
						// Frontend sends 'autoDelete' as the timer in seconds (0 means disabled)
						if autoDeleteTimer, ok := general["autoDelete"].(float64); ok && autoDeleteTimer > 0 {
							time.AfterFunc(time.Duration(autoDeleteTimer)*time.Second, func() {
								_ = tg.DeleteMessage(context.Background(), chatID, res.MessageID)
							})
						} else if autoDeleteStr, ok := general["autoDeleteTimer"].(string); ok && autoDeleteStr != "0" && autoDeleteStr != "" {
							var timerSecs float64
							if _, err := fmt.Sscanf(autoDeleteStr, "%f", &timerSecs); err == nil && timerSecs > 0 {
								time.AfterFunc(time.Duration(timerSecs)*time.Second, func() {
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

// ProcessNewMember sends a welcome message to newly joined members if enabled
func (s *AutoResponderService) ProcessNewMember(ctx context.Context, tg *telegram.BotAPIClient, channelID uuid.UUID, chatID int64, newMembers []telegram.User) (bool, error) {
	if len(newMembers) == 0 {
		return false, nil
	}

	settings, err := s.channelRepo.GetChannelSettings(ctx, channelID)
	if err != nil || settings == nil || len(settings.AutoResponder) == 0 {
		return false, err
	}

	var schema AutoResponderSchema
	if err := json.Unmarshal(settings.AutoResponder, &schema); err != nil {
		return false, err
	}

	if !schema.Enabled || !schema.NewMemberWelcome || schema.WelcomeText == "" {
		return false, nil
	}

	// Just welcome the first new member in the list to avoid spamming for bulk adds
	memberName := newMembers[0].FirstName

	replyText := strings.ReplaceAll(schema.WelcomeText, "$name", memberName)

	delaySeconds := 0
	if schema.WelcomeDelay != "" {
		fmt.Sscanf(schema.WelcomeDelay, "%d", &delaySeconds)
	}

	// Send message
	if delaySeconds > 0 {
		time.AfterFunc(time.Duration(delaySeconds)*time.Second, func() {
			_, err := tg.SendMessageWithResult(context.Background(), chatID, replyText, nil, nil)
			if err != nil {
				slog.Error("Failed to send delayed welcome message", "error", err, "chat_id", chatID)
			}
		})
	} else {
		_, err := tg.SendMessageWithResult(ctx, chatID, replyText, nil, nil)
		if err != nil {
			slog.Error("Failed to send welcome message", "error", err, "chat_id", chatID)
			return false, err
		}
	}

	return true, nil
}

// ProcessAutoFirstComment leaves an automatic first comment on a linked discussion group
func (s *AutoResponderService) ProcessAutoFirstComment(ctx context.Context, tg *telegram.BotAPIClient, channelID uuid.UUID, chatID int64, messageID int, postText ...string) (bool, error) {
	settings, err := s.channelRepo.GetChannelSettings(ctx, channelID)
	if err != nil || settings == nil || len(settings.AutoResponder) == 0 {
		return false, err
	}

	var schema AutoResponderSchema
	if err := json.Unmarshal(settings.AutoResponder, &schema); err != nil {
		return false, err
	}

	if !schema.Enabled || !schema.AutoFirstComment {
		return false, nil
	}

	var replyText string
	switch schema.CommentMode {
	case "fixed":
		replyText = schema.FixedComment
	case "rotating":
		if len(schema.RotatingTexts) > 0 {
			replyText = schema.RotatingTexts[time.Now().UnixNano()%int64(len(schema.RotatingTexts))]
		}
	case "ai":
		var textContext string
		if len(postText) > 0 {
			textContext = postText[0]
		}
		if textContext != "" {
			aiText, err := s.generateAIComment(ctx, channelID, textContext)
			if err == nil && strings.TrimSpace(aiText) != "" {
				replyText = aiText
			}
		}
		if replyText == "" && len(schema.RotatingTexts) > 0 {
			replyText = schema.RotatingTexts[0]
		}
		if replyText == "" {
			replyText = schema.FixedComment
		}
	}

	if replyText == "" {
		return false, nil
	}

	markup := s.getAutoResponderMarkup(ctx, channelID, schema.AttachButton)
	_, err = tg.SendMessageWithReplyAndMarkup(ctx, chatID, replyText, &messageID, markup, nil)
	if err != nil {
		slog.Error("failed to send auto first comment", "error", err, "chat_id", chatID, "message_id", messageID)
		return false, err
	}

	return true, nil
}
