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

// resolveChannelLLMCredentials gets LLM provider, API key, model, and persona prompt from channel settings or environment
func (s *AutoResponderService) resolveChannelLLMCredentials(ctx context.Context, channelID uuid.UUID) (provider, apiKey, model, customPrompt, tone string) {
	settings, err := s.channelRepo.GetChannelSettings(ctx, channelID)
	if err == nil && settings != nil && len(settings.Posting) > 0 {
		var posting PostingSettingsSchema
		if json.Unmarshal(settings.Posting, &posting) == nil {
			provider = posting.AiProvider
			apiKey = resolveEncryptedKey(posting.ApiKey)
			model = posting.AiModel
			customPrompt = posting.CustomSkillPrompt
			tone = posting.Tone
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

// generateAIComment produces a context-aware comment for a channel post adhering to channel persona
func (s *AutoResponderService) generateAIComment(ctx context.Context, channelID uuid.UUID, postText string) (string, error) {
	provider, apiKey, model, customPrompt, tone := s.resolveChannelLLMCredentials(ctx, channelID)
	if apiKey == "" {
		return "", fmt.Errorf("no LLM API key configured for AI comment")
	}

	systemPrompt := "You are an AI assistant for a Telegram channel. Your job is to write a short, highly relevant, engaging first comment or TL;DR for the channel post provided inside <POST> tags.\n"
	if strings.TrimSpace(customPrompt) != "" {
		systemPrompt += fmt.Sprintf("CHANNEL CUSTOM PERSONA & INSTRUCTIONS:\n%s\n", customPrompt)
	}
	if strings.TrimSpace(tone) != "" {
		systemPrompt += fmt.Sprintf("CHANNEL TONE: %s\n", tone)
	}
	systemPrompt += "HARD RULES:\n" +
		"1. Respond in the EXACT same language as the post (e.g. Persian if post is in Persian).\n" +
		"2. Keep it concise (1 to 2 sentences max or a sharp 3-bullet TL;DR).\n" +
		"3. Sound natural, authentic to the channel persona, and human.\n" +
		"4. Return ONLY the comment text without code fences, quotes, or preambles."

	userMsg := fmt.Sprintf("<POST>\n%s\n</POST>", postText)
	return CallLLM(ctx, provider, apiKey, model, systemPrompt, userMsg, false)
}

// generateAIResponse produces a context-aware auto-response to a message
func (s *AutoResponderService) generateAIResponse(ctx context.Context, channelID uuid.UUID, userText string, instruction string) (string, error) {
	provider, apiKey, model, _, _ := s.resolveChannelLLMCredentials(ctx, channelID)
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

// ProcessMessage evaluates a message against the auto-responder rules for a project or channel.
// Returns true if an auto-response was triggered and sent.
func (s *AutoResponderService) ProcessMessage(ctx context.Context, tg *telegram.BotAPIClient, channelID uuid.UUID, chatID int64, messageID int, text string) (bool, error) {
	if text == "" {
		return false, nil
	}

	// 1. Check Project-level auto-responder rules first
	if projects, pErr := s.channelRepo.GetAllActiveProjects(ctx); pErr == nil && len(projects) > 0 {
		for _, p := range projects {
			if !isProjectSubscriptionValid(p) || len(p.PipelineConfig) == 0 {
				continue
			}
			var pCfg map[string]interface{}
			if err := json.Unmarshal(p.PipelineConfig, &pCfg); err != nil {
				continue
			}
			arRaw, ok := pCfg["auto_responder"]
			if !ok || arRaw == nil {
				continue
			}
			arBytes, _ := json.Marshal(arRaw)
			var schema AutoResponderSchema
			if err := json.Unmarshal(arBytes, &schema); err != nil || !schema.Enabled {
				continue
			}

			targetType := strings.ToLower(strings.TrimSpace(schema.Target))
			isMatch := false
			if targetType == "input" {
				if p.SourceChatID != nil && *p.SourceChatID == chatID {
					isMatch = true
				}
			} else {
				// default to output channel
				if p.TargetChatID != nil && *p.TargetChatID == chatID {
					isMatch = true
				}
			}

			if isMatch {
				return s.executeRules(ctx, tg, p.ID, chatID, messageID, text, schema, nil)
			}
		}
	}

	// 2. Fallback to channel-level settings
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

	return s.executeRules(ctx, tg, channelID, chatID, messageID, text, schema, settings.General)
}

func (s *AutoResponderService) executeRules(ctx context.Context, tg *telegram.BotAPIClient, entityID uuid.UUID, chatID int64, messageID int, text string, schema AutoResponderSchema, generalRaw json.RawMessage) (bool, error) {
	textLower := strings.ToLower(text)

	for _, rule := range schema.Rules {
		if rule.Enabled != nil && !*rule.Enabled {
			continue
		}

		matched := false

		keys := rule.Keys
		if keys == "" {
			keys = rule.Trigger
		}

		matchType := rule.Match
		if matchType == "" {
			matchType = rule.Type
		}
		if matchType == "" {
			matchType = "contains"
		}

		switch matchType {
		case "exact":
			matched = strings.ToLower(keys) == textLower
		case "contains":
			parts := strings.Split(keys, ",")
			for _, key := range parts {
				if strings.Contains(textLower, strings.ToLower(strings.TrimSpace(key))) {
					matched = true
					break
				}
			}
		case "regex":
			re, err := regexp.Compile("(?i)" + keys)
			if err == nil && re.MatchString(text) {
				matched = true
			}
		case "keyword":
			pattern := `(?i)(^|[\s\p{P}])` + regexp.QuoteMeta(keys) + `([\s\p{P}]|$)`
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
				replyText = rule.Response
			}

			if rule.UseAI || matchType == "ai" {
				aiReply, err := s.generateAIResponse(ctx, entityID, text, replyText)
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
						dropKey := fmt.Sprintf("ar_stats:drops:%s:%s", entityID.String(), time.Now().Format("2006-01-02"))
						_ = cache.Client.Incr(ctx, dropKey)
						_ = cache.Client.Expire(ctx, dropKey, 48*time.Hour)
						slog.Warn("Auto-Responder rate limit exceeded", "chat_id", chatID)
						return false, nil
					}
				}

				// Send the reply with inline keyboard markup if configured
				markup := s.getAutoResponderMarkup(ctx, entityID, schema.AttachButton)
				res, err := tg.SendMessageWithReplyAndMarkup(ctx, chatID, replyText, &messageID, markup, nil)
				if err != nil {
					slog.Error("failed to send auto response", "error", err, "chat_id", chatID, "message_id", messageID)
				} else if res != nil {
					if cache := s.channelRepo.GetCache(); cache != nil && cache.Client != nil {
						respKey := fmt.Sprintf("ar_stats:responses:%s:%s", entityID.String(), time.Now().Format("2006-01-02"))
						_ = cache.Client.Incr(ctx, respKey)
						_ = cache.Client.Expire(ctx, respKey, 48*time.Hour)
					}
					// Handle Auto Delete
					if len(generalRaw) > 0 {
						var general map[string]interface{}
						if json.Unmarshal(generalRaw, &general) == nil {
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

func (s *AutoResponderService) ProcessAutoFirstComment(ctx context.Context, tg *telegram.BotAPIClient, channelID uuid.UUID, chatID int64, messageID int, postText ...string) (bool, error) {
	// 1. Check Project-level first comment configuration first
	if projects, pErr := s.channelRepo.GetAllActiveProjects(ctx); pErr == nil && len(projects) > 0 {
		for _, p := range projects {
			if !isProjectSubscriptionValid(p) || len(p.PipelineConfig) == 0 {
				continue
			}
			var pCfg map[string]interface{}
			if err := json.Unmarshal(p.PipelineConfig, &pCfg); err != nil {
				continue
			}
			arRaw, ok := pCfg["auto_responder"]
			if !ok || arRaw == nil {
				continue
			}
			arBytes, _ := json.Marshal(arRaw)
			var schema AutoResponderSchema
			if err := json.Unmarshal(arBytes, &schema); err != nil || !schema.Enabled || !schema.AutoFirstComment {
				continue
			}

			targetType := strings.ToLower(strings.TrimSpace(schema.Target))
			isMatch := false
			if targetType == "input" {
				if (p.SourceChatID != nil && *p.SourceChatID == chatID) || (p.SourceChannelID != nil && *p.SourceChannelID == channelID) {
					isMatch = true
				}
			} else {
				if (p.TargetChatID != nil && *p.TargetChatID == chatID) || (p.TargetChannelID != nil && *p.TargetChannelID == channelID) {
					isMatch = true
				}
			}

			if isMatch {
				return s.executeFirstComment(ctx, tg, p.ID, chatID, messageID, schema, postText...)
			}
		}
	}

	// 2. Fallback to channel-level settings
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

	return s.executeFirstComment(ctx, tg, channelID, chatID, messageID, schema, postText...)
}

func (s *AutoResponderService) executeFirstComment(ctx context.Context, tg *telegram.BotAPIClient, entityID uuid.UUID, chatID int64, messageID int, schema AutoResponderSchema, postText ...string) (bool, error) {
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
			aiText, err := s.generateAIComment(ctx, entityID, textContext)
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

	markup := s.getAutoResponderMarkup(ctx, entityID, schema.AttachButton)
	_, err := tg.SendMessageWithReplyAndMarkup(ctx, chatID, replyText, &messageID, markup, nil)
	if err != nil {
		slog.Error("failed to send auto first comment", "error", err, "chat_id", chatID, "message_id", messageID)
		return false, err
	}

	return true, nil
}

type AutoResponderStats struct {
	TodayResponses int64 `json:"today_responses"`
	TodayDrops     int64 `json:"today_drops"`
}

func (s *AutoResponderService) GetAutoResponderStats(ctx context.Context, channelID uuid.UUID) AutoResponderStats {
	var stats AutoResponderStats
	cache := s.channelRepo.GetCache()
	if cache == nil || cache.Client == nil {
		return stats
	}

	today := time.Now().Format("2006-01-02")
	respKey := fmt.Sprintf("ar_stats:responses:%s:%s", channelID.String(), today)
	dropKey := fmt.Sprintf("ar_stats:drops:%s:%s", channelID.String(), today)

	if val, err := cache.Client.Get(ctx, respKey).Int64(); err == nil {
		stats.TodayResponses = val
	}
	if val, err := cache.Client.Get(ctx, dropKey).Int64(); err == nil {
		stats.TodayDrops = val
	}

	return stats
}

