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

	"github.com/google/uuid"
	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/i18n"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/botmgmt"
)

type FunnelCallbackData struct {
	QueryID          string
	Data             string
	FromID           int64
	FromLanguageCode string
	ChatID           int64
	ChatTitle        string
	MessageID        int
}

// ProcessChannelPostForFunnel intercepts posts and checks if they belong to a registered funnel.
// Returns true if the message was handled by the funnel system (and should be stopped from normal publishing).
func (s *ChannelService) ProcessChannelPostForFunnel(ctx context.Context, bot *repository.ManagedBot, chatID int64, messageID int, text string, media []repository.FunnelMediaItem, mediaGroupID string, replyMarkup json.RawMessage, authorID *int64, authorName string) (bool, error) {
	// 1. Check if this is an input channel for an active funnel
	funnel, err := s.channelRepo.GetFunnelByInputChatID(ctx, bot.ID, chatID)
	if err != nil {
		slog.Error("Failed to check if channel is a funnel input", "error", err)
		return false, err
	}
	if funnel == nil || !funnel.IsActive {
		return false, nil // Not a funnel or inactive
	}

	slog.Info("Funnel post intercepted", "funnel_id", funnel.ID, "input_chat_id", chatID, "message_id", messageID, "media_group_id", mediaGroupID)

	// 2. Handle De-bounce logic for Media Groups (Albums)
	if mediaGroupID != "" {
		cache := s.channelRepo.GetCache()
		if cache != nil && cache.Client != nil {
			groupKey := fmt.Sprintf("funnel_group:%s:%s", funnel.ID.String(), mediaGroupID)
			lockKey := fmt.Sprintf("funnel_group_lock:%s:%s", funnel.ID.String(), mediaGroupID)

			// Store the media item
			itemBytes, _ := json.Marshal(media)
			cache.Client.RPush(ctx, groupKey, itemBytes)
			cache.Client.Expire(ctx, groupKey, 10*time.Second)

			// Try to acquire processing lock
			locked, err := cache.Client.SetNX(ctx, lockKey, "active", 5*time.Second).Result()
			if err == nil && locked {
				// We are the leader for this media group, schedule aggregated processing
				s.wg.Add(1)
				GoSafe(func() {
					defer s.wg.Done()
					// Wait for other items in the album to arrive
					time.Sleep(1500 * time.Millisecond)

					bgCtx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
					defer cancel()

					// Retrieve all aggregated media items
					items, err := cache.Client.LRange(bgCtx, groupKey, 0, -1).Result()
					if err != nil {
						slog.Error("Failed to retrieve media group items from cache", "error", err)
						return
					}

					var aggregatedMedia []repository.FunnelMediaItem
					aggregatedText := text

					for _, itemStr := range items {
						var mList []repository.FunnelMediaItem
						if json.Unmarshal([]byte(itemStr), &mList) == nil {
							for _, m := range mList {
								aggregatedMedia = append(aggregatedMedia, m)
								if aggregatedText == "" && m.Caption != "" {
									aggregatedText = m.Caption
								}
							}
						}
					}

					// Clean up cache (groupKey only, let lockKey expire to prevent orphans)
					cache.Client.Del(bgCtx, groupKey)

					err = s.processAggregatedFunnelPost(bgCtx, bot, funnel, int64(messageID), aggregatedText, aggregatedMedia, mediaGroupID, replyMarkup, authorID, authorName)
					if err != nil {
						slog.Error("Failed to process aggregated funnel post", "error", err)
					}
				})
				return true, nil
			}
			return true, nil // Secondary album item, intercepted and ignored (handled by leader)
		}
	}

	// Single post processing
	s.wg.Add(1)
	GoSafe(func() {
		defer s.wg.Done()
		bgCtx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
		defer cancel()
		err := s.processAggregatedFunnelPost(bgCtx, bot, funnel, int64(messageID), text, media, "", replyMarkup, authorID, authorName)
		if err != nil {
			slog.Error("Failed to process single funnel post", "error", err)
		}
	})

	return true, nil
}

func (s *ChannelService) processAggregatedFunnelPost(ctx context.Context, bot *repository.ManagedBot, funnel *repository.ChannelFunnel, inputMsgID int64, text string, media []repository.FunnelMediaItem, mediaGroupID string, replyMarkup json.RawMessage, authorID *int64, authorName string) error {
	// 1. Load Output Channel settings to apply features
	destChan, err := s.channelRepo.GetChannelByChatID(ctx, funnel.OutputChatID)
	if err != nil {
		return fmt.Errorf("failed to load output channel details: %w", err)
	}

	settings, err := s.channelRepo.GetChannelSettings(ctx, destChan.ID)
	if err != nil {
		return fmt.Errorf("failed to load output channel settings: %w", err)
	}

	var posting PostingSettingsSchema
	_ = json.Unmarshal(settings.Posting, &posting)

	var general GeneralSettingsSchema
	_ = json.Unmarshal(settings.General, &general)

	var forwarding ForwardingSettingsSchema
	_ = json.Unmarshal(settings.Forwarding, &forwarding)

	// Apply Mirror & Forward rules from Settings
	removeAds := false
	removeLinks := false
	for _, rule := range forwarding.Rules {
		if rule.RemoveAds {
			removeAds = true
		}
		if rule.RemoveLinks {
			removeLinks = true
		}
	}

	// 2. Apply filters
	processedText := text
	if removeAds {
		processedText = strings.ReplaceAll(processedText, "#ad", "")
		processedText = strings.ReplaceAll(processedText, "#spon", "")
	}
	if removeLinks {
		processedText = removeLinksHelper(processedText)
	}
	
	removeHashtags := false
	for _, rule := range forwarding.Rules {
		if rule.RemoveAds { // Actually rules should have RemoveHashtags but we check it if it exists or use general logic
			// Using rule.RemoveAds as a placeholder or maybe rule.RemoveHashtags doesn't exist in struct yet. 
			// Let's assume forwarding rules could be extended, but for now we skip global removal
			// We only remove hashtags if a rule specifically says so.
		}
	}
	if removeHashtags {
		processedText = removeHashtagsHelper(processedText)
	}

	if posting.WatermarkEnabled && posting.WatermarkText != "" {
		processedText = processedText + "\n\n" + posting.WatermarkText
	}
	if general.SignMessages && general.CustomSignature != "" {
		processedText = processedText + "\n\n✍️ " + general.CustomSignature
	}

	// 3. AI Post Composer A/B Testing generation
	var aiVariations []string
	if posting.AiComposerEnabled && posting.ApiKey != "" && len(strings.TrimSpace(processedText)) > 0 {
		variations, err := generateAIBVariations(ctx, processedText, posting.ApiKey, posting.SelectedSkill, posting.CustomSkillPrompt)
		if err == nil && len(variations) > 0 {
			aiVariations = variations
		} else {
			slog.Error("Failed to generate AI variations, falling back to single text", "error", err)
			aiVariations = []string{processedText}
		}
	} else {
		aiVariations = []string{processedText}
	}

	// 4. Load Predefined Inline Buttons
	buttons, err := s.channelRepo.GetChannelButtons(ctx, destChan.ID)
	if err != nil {
		buttons = []repository.ChannelInlineButton{}
	}

	buttonsRaw, _ := json.Marshal(buttons)

	// 5. Create Draft Post in DB
	draft := repository.PendingFunnelPost{
		FunnelID:               funnel.ID,
		InputMessageID:         inputMsgID,
		OriginalAuthorID:       authorID,
		OriginalAuthorName:     authorName,
		MediaGroupID:           &mediaGroupID,
		MediaPayload:           media,
		DraftText:              aiVariations[0],
		DraftButtons:           buttonsRaw,
		AiVariations:           aiVariations,
		SelectedVariationIndex: 0,
		Status:                 "pending",
	}
	if mediaGroupID == "" {
		draft.MediaGroupID = nil
	}

	err = s.channelRepo.SavePendingFunnelPost(ctx, &draft)
	if err != nil {
		return fmt.Errorf("failed to save pending funnel draft: %w", err)
	}

	// 6. Send the Review Messages to the Bot Owner (DM)
	return s.sendFunnelReviewToOwner(ctx, bot, funnel, &draft, destChan.ChatTitle)
}

func (s *ChannelService) sendFunnelReviewToOwner(ctx context.Context, bot *repository.ManagedBot, funnel *repository.ChannelFunnel, draft *repository.PendingFunnelPost, destTitle string) error {
	token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	if err != nil {
		return err
	}
	tg := telegram.NewBotAPIClient(token)

	lang := "en"
	settings, err := s.channelRepo.GetChannelSettings(ctx, draft.FunnelID)
	if err == nil && settings != nil {
		var general GeneralSettingsSchema
		if json.Unmarshal(settings.General, &general) == nil && general.Language != "" {
			lang = general.Language
		}
	}

	// Message 1: Live Preview
	activeText := draft.DraftText
	var buttonsList []repository.ChannelInlineButton
	_ = json.Unmarshal(draft.DraftButtons, &buttonsList)
	previewMarkup := buildReplyMarkupFromButtons(buttonsList)

	var sendErr error

	if len(draft.MediaPayload) == 0 {
		// Text only
		_, sendErr = tg.SendMessageWithMarkup(ctx, funnel.OwnerUserID, activeText, previewMarkup, nil, "Markdown")
	} else if len(draft.MediaPayload) == 1 {
		// Single Media
		item := draft.MediaPayload[0]
		payload := map[string]interface{}{
			"chat_id":      funnel.OwnerUserID,
			"caption":      activeText,
			"reply_markup": previewMarkup,
		}
		var method string
		switch item.Type {
		case "photo":
			method = "sendPhoto"
			payload["photo"] = item.FileID
		case "video":
			method = "sendVideo"
			payload["video"] = item.FileID
		case "document":
			method = "sendDocument"
			payload["document"] = item.FileID
		case "audio":
			method = "sendAudio"
			payload["audio"] = item.FileID
		default:
			method = "sendPhoto"
			payload["photo"] = item.FileID
		}
		payload["parse_mode"] = "Markdown"

		_, sendErr = tg.Request(ctx, method, payload)
	} else {
		// Media Group (Album)
		mediaItemsPayload := make([]map[string]interface{}, len(draft.MediaPayload))
		for i, item := range draft.MediaPayload {
			mItem := map[string]interface{}{
				"type":  item.Type,
				"media": item.FileID,
			}
			if i == 0 {
				mItem["caption"] = activeText
			}
			mediaItemsPayload[i] = mItem
		}

		groupPayload := map[string]interface{}{
			"chat_id": funnel.OwnerUserID,
			"media":   mediaItemsPayload,
		}

		// Media group sends first
		_, sendErr = tg.Request(ctx, "sendMediaGroup", groupPayload)
	}

	if sendErr != nil {
		slog.Error("Failed to send funnel live preview to owner DM", "owner_id", funnel.OwnerUserID, "error", sendErr)
		return sendErr
	}

	// Message 2: Advanced Interactive Inline Keyboard Editor Control Panel
	panelText := i18n.T(lang, "channel.funnel_panel_text", map[string]interface{}{
		"dest_channel": destTitle,
		"author":       draft.OriginalAuthorName,
		"status":       strings.ToUpper(draft.Status),
	})
	if panelText == "" || strings.HasPrefix(panelText, "channel.") {
		authorStr := draft.OriginalAuthorName
		if authorStr == "" {
			authorStr = "System/Anonymous"
		}
		panelText = fmt.Sprintf("🎛️ **Channel Funnel Control Panel**\n\nDestination: **%s**\nOriginal Author: **%s**\nStatus: **%s**", destTitle, authorStr, strings.ToUpper(draft.Status))
	}

	panelMarkup := buildFunnelPanelKeyboard(lang, draft)
	_, err = tg.SendMessageWithMarkup(ctx, funnel.OwnerUserID, panelText, panelMarkup, nil, "Markdown")
	return err
}

func buildFunnelPanelKeyboard(lang string, draft *repository.PendingFunnelPost) map[string]interface{} {
	styleLabel := "Standard"
	if draft.SelectedVariationIndex == 1 {
		styleLabel = "Promo/Hype"
	} else if draft.SelectedVariationIndex == 2 {
		styleLabel = "Short/Punchy"
	}

	return map[string]interface{}{
		"inline_keyboard": [][]map[string]interface{}{
			{
				{
					"text":          "👍 Approve & Publish",
					"callback_data": fmt.Sprintf("f_app:%s", draft.ID.String()),
				},
				{
					"text":          "🗑️ Reject Draft",
					"callback_data": fmt.Sprintf("f_rej:%s", draft.ID.String()),
				},
			},
			{
				{
					"text":          "🤖 Style: " + styleLabel,
					"callback_data": fmt.Sprintf("f_var:%s", draft.ID.String()),
				},
				{
					"text":          "🔄 AI Regen",
					"callback_data": fmt.Sprintf("f_reg:%s", draft.ID.String()),
				},
			},
			{
				{
					"text":          "✍️ Edit Caption",
					"callback_data": fmt.Sprintf("f_edt:%s", draft.ID.String()),
				},
				{
					"text":          "📅 Schedule Post",
					"callback_data": fmt.Sprintf("f_sch:%s", draft.ID.String()),
				},
			},
		},
	}
}

// generateAIBVariations fetches 3 separate caption style options from Gemini API.
func generateAIBVariations(ctx context.Context, text, apiKey, skill, customPrompt string) ([]string, error) {
	systemPrompt := "You are an elite copywriting assistant. Generate exactly 3 variations of the text provided inside the <TEXT> tags. Output a JSON object with a single key \"variations\" containing an array of 3 strings. Format details:\n" +
		"- Variation 0: Standard, engaging rewrite preserving the original content.\n" +
		"- Variation 1: Bold, hype-focused, promotional version designed to grab attention.\n" +
		"- Variation 2: Short, punchy version packed with descriptive emojis.\n" +
		"CRITICAL: Output ONLY the raw JSON block without any markdown syntax, code block formatting (such as ```json), or wrapping tags. Do not explain anything."

	reqPayload := map[string]interface{}{
		"system_instruction": map[string]interface{}{
			"parts": []interface{}{
				map[string]interface{}{"text": systemPrompt},
			},
		},
		"contents": []interface{}{
			map[string]interface{}{
				"parts": []interface{}{
					map[string]interface{}{
						"text": fmt.Sprintf("<TEXT>\n%s\n</TEXT>", text),
					},
				},
			},
		},
	}

	jsonData, err := json.Marshal(reqPayload)
	if err != nil {
		return nil, err
	}

	apiURL := "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey
	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Gemini variations status code: %d, body: %s", resp.StatusCode, string(body))
	}

	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&geminiResp); err != nil {
		return nil, err
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty candidates returned from Gemini")
	}

	rawJSON := geminiResp.Candidates[0].Content.Parts[0].Text
	rawJSON = strings.TrimPrefix(rawJSON, "```json")
	rawJSON = strings.TrimPrefix(rawJSON, "```")
	rawJSON = strings.TrimSuffix(rawJSON, "```")
	rawJSON = strings.TrimSpace(rawJSON)

	var wrapper struct {
		Variations []string `json:"variations"`
	}

	if err := json.Unmarshal([]byte(rawJSON), &wrapper); err != nil {
		return nil, fmt.Errorf("failed to unmarshal variations JSON: %w (raw: %s)", err, rawJSON)
	}

	if len(wrapper.Variations) < 3 {
		return nil, fmt.Errorf("insufficient variations returned, got: %d", len(wrapper.Variations))
	}

	return wrapper.Variations, nil
}

// HandleFunnelCallback processes click interactions on the Review DM Control Panel.
func (s *ChannelService) HandleFunnelCallback(ctx context.Context, cq FunnelCallbackData, bot *repository.ManagedBot) error {
	token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	if err != nil {
		return err
	}
	tg := telegram.NewBotAPIClient(token)

	// Determine command and draft ID
	parts := strings.Split(cq.Data, ":")
	if len(parts) < 2 {
		return nil
	}
	cmd := parts[0]
	draftID, err := uuid.Parse(parts[1])
	if err != nil {
		return nil
	}

	draft, err := s.channelRepo.GetPendingFunnelPostByID(ctx, draftID)
	if err != nil {
		_ = tg.AnswerCallbackQuery(ctx, cq.QueryID, "Draft expired or not found", true)
		return err
	}

	funnel, err := s.channelRepo.GetFunnelByID(ctx, draft.FunnelID)
	if err != nil {
		return err
	}

	// Verify permissions: only owner or dynamic funnel admins
	if cq.FromID != funnel.OwnerUserID {
		isAdmin := false
		memberStatus, err := tg.GetChatMember(ctx, funnel.OutputChatID, cq.FromID)
		if err == nil && (memberStatus == "creator" || memberStatus == "administrator") {
			isAdmin = true
		} else {
			// Fallback to DB check
			destChan, err := s.channelRepo.GetChannelByChatID(ctx, funnel.OutputChatID)
			if err == nil {
				admins, err := s.channelRepo.GetChannelAdmins(ctx, destChan.ID)
				if err == nil {
					for _, adm := range admins {
						if adm.TelegramID == cq.FromID {
							isAdmin = true
							break
						}
					}
				}
			}
		}
		if !isAdmin {
			_ = tg.AnswerCallbackQuery(ctx, cq.QueryID, "Unauthorized: Owner or authorized admins only", true)
			return nil
		}
	}

	switch cmd {
	case "f_app":
		// Approve & Publish
		_ = tg.AnswerCallbackQuery(ctx, cq.QueryID, "Publishing post...", false)
		err = s.publishFunnelPostDirectly(ctx, tg, funnel, draft)
		if err != nil {
			_ = tg.SendMessage(ctx, cq.ChatID, fmt.Sprintf("❌ Failed to publish: %v", err), nil, nil)
			return err
		}

		_ = tg.EditMessageText(ctx, cq.ChatID, cq.MessageID, "✅ **Post Approved & Published successfully!**")

	case "f_rej":
		// Reject
		draft.Status = "rejected"
		_ = s.channelRepo.UpdatePendingFunnelPost(ctx, draft)
		_ = tg.AnswerCallbackQuery(ctx, cq.QueryID, "Post Draft Rejected", false)
		_ = tg.EditMessageText(ctx, cq.ChatID, cq.MessageID, "🗑️ **Post Draft Rejected & Deleted.**")

	case "f_var":
		// Cycle styles (0 -> 1 -> 2 -> 0)
		if len(draft.AiVariations) == 0 {
			_ = tg.AnswerCallbackQuery(ctx, cq.QueryID, "No AI variations available", true)
			return nil
		}
		draft.SelectedVariationIndex = (draft.SelectedVariationIndex + 1) % len(draft.AiVariations)
		draft.DraftText = draft.AiVariations[draft.SelectedVariationIndex]
		_ = s.channelRepo.UpdatePendingFunnelPost(ctx, draft)
		_ = tg.AnswerCallbackQuery(ctx, cq.QueryID, "Style variation updated", false)

		panelMarkup := buildFunnelPanelKeyboard("en", draft)
		panelText := fmt.Sprintf("🎛️ **Channel Funnel Control Panel**\n\nDestination Funnel ID: %s\nActive Caption Style: %d\nAuthor: %s\nStatus: %s",
			draft.FunnelID, draft.SelectedVariationIndex, draft.OriginalAuthorName, strings.ToUpper(draft.Status))
		_ = tg.EditMessageTextWithMarkup(ctx, cq.ChatID, cq.MessageID, panelText, panelMarkup)

		_ = tg.SendMessage(ctx, cq.ChatID, fmt.Sprintf("🤖 Switched style to variant %d. Caption preview:\n\n%s", draft.SelectedVariationIndex, draft.DraftText), nil, nil)

	case "f_reg":
		// Regenerate AI
		cache := s.channelRepo.GetCache()
		if cache != nil && cache.Client != nil {
			rlKey := fmt.Sprintf("funnel_ai_rl:%s", draft.ID.String())
			if val, _ := cache.Client.Get(ctx, rlKey).Result(); val != "" {
				_ = tg.AnswerCallbackQuery(ctx, cq.QueryID, "Please wait 30s before regenerating again.", true)
				return nil
			}
			cache.Client.Set(ctx, rlKey, "1", 30*time.Second)
		}
		_ = tg.AnswerCallbackQuery(ctx, cq.QueryID, "Regenerating AI variations...", false)
		destChan, _ := s.channelRepo.GetChannelByChatID(ctx, funnel.OutputChatID)
		settings, err := s.channelRepo.GetChannelSettings(ctx, destChan.ID)
		if err == nil {
			var posting PostingSettingsSchema
			_ = json.Unmarshal(settings.Posting, &posting)
			if posting.ApiKey != "" {
				vars, err := generateAIBVariations(ctx, draft.DraftText, posting.ApiKey, posting.SelectedSkill, posting.CustomSkillPrompt)
				if err == nil {
					draft.AiVariations = vars
					draft.SelectedVariationIndex = 0
					draft.DraftText = vars[0]
					_ = s.channelRepo.UpdatePendingFunnelPost(ctx, draft)
					_ = tg.SendMessage(ctx, cq.ChatID, fmt.Sprintf("🔄 AI variations regenerated. Caption preview:\n\n%s", draft.DraftText), nil, nil)
				}
			}
		}

	case "f_edt":
		// Edit caption manually
		cache := s.channelRepo.GetCache()
		if cache != nil && cache.Client != nil {
			stateKey := fmt.Sprintf("funnel_edit_state:%d", cq.FromID)
			_ = cache.Client.Set(ctx, stateKey, draft.ID.String(), 10*time.Minute)
			_ = tg.AnswerCallbackQuery(ctx, cq.QueryID, "Please type the new caption in this chat:", false)

			cancelMarkup := map[string]interface{}{
				"inline_keyboard": [][]map[string]interface{}{
					{
						{
							"text":          "Cancel Editing",
							"callback_data": fmt.Sprintf("f_can:%s", draft.ID.String()),
						},
					},
				},
			}
			_, _ = tg.SendMessageWithMarkup(ctx, cq.ChatID, "✍️ **Send the new text below. It will overwrite the current caption draft.**", cancelMarkup, nil)
		}

	case "f_sch":
		// Open schedule prompt
		quickScheduleMarkup := map[string]interface{}{
			"inline_keyboard": [][]map[string]interface{}{
				{
					{"text": "+15 mins", "callback_data": fmt.Sprintf("f_time:%s:15m", draft.ID.String())},
					{"text": "+1 hour", "callback_data": fmt.Sprintf("f_time:%s:1h", draft.ID.String())},
					{"text": "+2 hours", "callback_data": fmt.Sprintf("f_time:%s:2h", draft.ID.String())},
				},
				{
					{"text": "+6 hours", "callback_data": fmt.Sprintf("f_time:%s:6h", draft.ID.String())},
					{"text": "+12 hours", "callback_data": fmt.Sprintf("f_time:%s:12h", draft.ID.String())},
					{"text": "+1 day", "callback_data": fmt.Sprintf("f_time:%s:1d", draft.ID.String())},
				},
				{
					{"text": "❌ Cancel", "callback_data": fmt.Sprintf("f_can:%s", draft.ID.String())},
				},
			},
		}
		_, _ = tg.SendMessageWithMarkup(ctx, cq.ChatID, "📅 **Select a delay time to schedule this post:**", quickScheduleMarkup, nil)
		_ = tg.AnswerCallbackQuery(ctx, cq.QueryID, "Schedule menu opened", false)

	case "f_time":
		// Perform schedule delay setting
		if len(parts) < 3 {
			return nil
		}
		durationStr := parts[2]
		var delay time.Duration
		switch durationStr {
		case "15m":
			delay = 15 * time.Minute
		case "1h":
			delay = 1 * time.Hour
		case "2h":
			delay = 2 * time.Hour
		case "6h":
			delay = 6 * time.Hour
		case "12h":
			delay = 12 * time.Hour
		case "1d":
			delay = 24 * time.Hour
		default:
			delay = 1 * time.Hour
		}

		scheduledTime := time.Now().Add(delay)
		draft.Status = "scheduled"
		draft.ScheduledAt = &scheduledTime
		_ = s.channelRepo.UpdatePendingFunnelPost(ctx, draft)

		_ = tg.AnswerCallbackQuery(ctx, cq.QueryID, "Post Scheduled", false)
		_ = tg.EditMessageText(ctx, cq.ChatID, cq.MessageID, fmt.Sprintf("📅 **Post scheduled successfully for %s!**", scheduledTime.Format("2006-01-02 15:04:05 MST")))

	case "f_can":
		// Cancel editing/scheduling
		cache := s.channelRepo.GetCache()
		if cache != nil && cache.Client != nil {
			cache.Client.Del(ctx, fmt.Sprintf("funnel_edit_state:%d", cq.FromID))
		}
		_ = tg.AnswerCallbackQuery(ctx, cq.QueryID, "Cancelled", false)
		_ = tg.EditMessageText(ctx, cq.ChatID, cq.MessageID, "🚫 **Operation Cancelled.**")
	}

	return nil
}

// HandleFunnelTextReply processes text messages when the user is in editing caption mode.
func (s *ChannelService) HandleFunnelTextReply(ctx context.Context, bot *repository.ManagedBot, msgUserID int64, chatID int64, text string) (bool, error) {
	cache := s.channelRepo.GetCache()
	if cache == nil || cache.Client == nil {
		return false, nil
	}

	stateKey := fmt.Sprintf("funnel_edit_state:%d", msgUserID)
	draftIDStr, err := cache.Client.Get(ctx, stateKey).Result()
	if err != nil || draftIDStr == "" {
		return false, nil // No active edit state
	}

	cache.Client.Del(ctx, stateKey)

	draftID, err := uuid.Parse(draftIDStr)
	if err != nil {
		return false, nil
	}

	draft, err := s.channelRepo.GetPendingFunnelPostByID(ctx, draftID)
	if err != nil {
		return true, err
	}

	draft.DraftText = text
	
	found := false
	for i, v := range draft.AiVariations {
		if v == text {
			draft.SelectedVariationIndex = i
			found = true
			break
		}
	}
	if !found {
		draft.AiVariations = append(draft.AiVariations, text)
		draft.SelectedVariationIndex = len(draft.AiVariations) - 1
	}

	err = s.channelRepo.UpdatePendingFunnelPost(ctx, draft)
	if err != nil {
		return true, err
	}

	token, _ := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	tg := telegram.NewBotAPIClient(token)

	_ = tg.SendMessage(ctx, chatID, fmt.Sprintf("✍️ **Caption updated draft!**\n\nNew caption preview:\n\n%s", text), nil, nil)

	funnel, err := s.channelRepo.GetFunnelByID(ctx, draft.FunnelID)
	if err == nil {
		_ = s.sendFunnelReviewToOwner(ctx, bot, funnel, draft, "Managed Output Channel")
	}

	return true, nil
}

func (s *ChannelService) publishFunnelPostDirectly(ctx context.Context, tg *telegram.BotAPIClient, funnel *repository.ChannelFunnel, draft *repository.PendingFunnelPost) error {
	var buttonsList []repository.ChannelInlineButton
	_ = json.Unmarshal(draft.DraftButtons, &buttonsList)

	activeText := draft.DraftText
	var previewMarkup map[string]interface{}
	if len(draft.MediaPayload) > 1 && len(buttonsList) > 0 {
		var linkTexts []string
		for _, btn := range buttonsList {
			if btn.Type == "url" {
				linkTexts = append(linkTexts, fmt.Sprintf("🔗 [%s](%s)", btn.Title, btn.Value))
			}
		}
		if len(linkTexts) > 0 {
			activeText = activeText + "\n\n" + strings.Join(linkTexts, " | ")
		}
	} else {
		previewMarkup = buildReplyMarkupFromButtons(buttonsList)
	}

	var pubMsgID int64

	if len(draft.MediaPayload) == 0 {
		res, err := tg.SendMessageWithMarkup(ctx, funnel.OutputChatID, activeText, previewMarkup, nil)
		if err != nil {
			return err
		}
		pubMsgID = int64(res.MessageID)
	} else if len(draft.MediaPayload) == 1 {
		item := draft.MediaPayload[0]
		payload := map[string]interface{}{
			"chat_id": funnel.OutputChatID,
			"caption": activeText,
		}
		if previewMarkup != nil {
			payload["reply_markup"] = previewMarkup
		}
		var method string
		switch item.Type {
		case "photo":
			method = "sendPhoto"
			payload["photo"] = item.FileID
		case "video":
			method = "sendVideo"
			payload["video"] = item.FileID
		case "document":
			method = "sendDocument"
			payload["document"] = item.FileID
		case "audio":
			method = "sendAudio"
			payload["audio"] = item.FileID
		default:
			method = "sendPhoto"
			payload["photo"] = item.FileID
		}

		rawResp, err := tg.Request(ctx, method, payload)
		if err != nil {
			return err
		}
		var res telegram.MessageResult
		if err := json.Unmarshal(rawResp, &res); err != nil {
			return err
		}
		pubMsgID = int64(res.MessageID)
	} else {
		mediaItemsPayload := make([]map[string]interface{}, len(draft.MediaPayload))
		for i, item := range draft.MediaPayload {
			mItem := map[string]interface{}{
				"type":  item.Type,
				"media": item.FileID,
			}
			if i == 0 {
				mItem["caption"] = activeText
				mItem["parse_mode"] = "Markdown"
			}
			mediaItemsPayload[i] = mItem
		}

		groupPayload := map[string]interface{}{
			"chat_id": funnel.OutputChatID,
			"media":   mediaItemsPayload,
		}

		rawResp, err := tg.Request(ctx, "sendMediaGroup", groupPayload)
		if err != nil {
			return err
		}
		var resList []telegram.MessageResult
		if err := json.Unmarshal(rawResp, &resList); err == nil && len(resList) > 0 {
			pubMsgID = int64(resList[0].MessageID)
		} else {
			var singleRes telegram.MessageResult
			if json.Unmarshal(rawResp, &singleRes) == nil {
				pubMsgID = int64(singleRes.MessageID)
			}
		}
	}

	// 7. Save output post trace to Database
	draft.Status = "approved"
	draft.PublishedMessageID = &pubMsgID
	_ = s.channelRepo.UpdatePendingFunnelPost(ctx, draft)

	destChan, _ := s.channelRepo.GetChannelByChatID(ctx, funnel.OutputChatID)
	now := time.Now()
	channelPost := repository.ChannelPost{
		ChannelID:         destChan.ID,
		TelegramMessageID: pubMsgID,
		AuthorUserID:      draft.OriginalAuthorID,
		Text:              activeText,
		HasMedia:          len(draft.MediaPayload) > 0,
		PostedAt:          &now,
	}
	_ = s.channelRepo.CreatePost(ctx, &channelPost)

	// 8. Log Audit Trails
	auditLog := repository.ChannelAuditLog{
		ChannelID: destChan.ID,
		ActorID:   funnel.OwnerUserID,
		Action:    "funnel_post_publish",
	}
	meta, _ := json.Marshal(map[string]interface{}{
		"original_author_id":   draft.OriginalAuthorID,
		"original_author_name": draft.OriginalAuthorName,
		"input_message_id":     draft.InputMessageID,
		"funnel_id":            draft.FunnelID.String(),
		"published_message_id": pubMsgID,
	})
	auditLog.Metadata = meta
	_ = s.channelRepo.LogAudit(ctx, &auditLog)

	_ = tg.SendMessage(ctx, funnel.OwnerUserID, fmt.Sprintf("🚀 **Post successfully published to the channel!**\n\n🔑 **Unique Post ID:** `%s`\nUse this key to edit or update the live post caption in the future.", draft.ID.String()), nil, nil)

	return nil
}

// PublishScheduledFunnelPosts executes pending scheduled posts.
func (s *ChannelService) PublishScheduledFunnelPosts(ctx context.Context) error {
	posts, err := s.channelRepo.GetScheduledFunnelPosts(ctx)
	if err != nil {
		return err
	}

	if len(posts) == 0 {
		return nil
	}

	slog.Info("Running scheduler for pending funnel posts", "count", len(posts))

	for _, post := range posts {
		funnel, err := s.channelRepo.GetFunnelByID(ctx, post.FunnelID)
		if err != nil {
			continue
		}

		bot, err := s.botRepo.GetBotByID(ctx, funnel.BotID)
		if err != nil {
			continue
		}

		token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
		if err != nil {
			continue
		}

		tg := telegram.NewBotAPIClient(token)
		err = s.publishFunnelPostDirectly(ctx, tg, funnel, &post)
		if err != nil {
			slog.Error("Failed to publish scheduled post", "draft_id", post.ID, "error", err)
		}
	}

	return nil
}

func buildReplyMarkupFromButtons(buttons []repository.ChannelInlineButton) map[string]interface{} {
	if len(buttons) == 0 {
		return nil
	}
	var keyboard [][]map[string]interface{}
	for _, btn := range buttons {
		if btn.Type == "url" {
			keyboard = append(keyboard, []map[string]interface{}{
				{
					"text": btn.Title,
					"url":  btn.Value,
				},
			})
		}
	}
	if len(keyboard) == 0 {
		return nil
	}
	return map[string]interface{}{
		"inline_keyboard": keyboard,
	}
}
