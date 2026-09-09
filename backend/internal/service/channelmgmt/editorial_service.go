package channelmgmt

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/botmgmt"

	"github.com/google/uuid"
)

type PreflightInput struct {
	SourceIdentifier string `json:"source_identifier"`
	TargetIdentifier string `json:"target_identifier"`
}

type PreflightChannelStatus struct {
	ChatID     int64  `json:"chat_id"`
	Title      string `json:"title"`
	Username   string `json:"username"`
	IsBotAdmin bool   `json:"is_bot_admin"`
	CanPost    bool   `json:"can_post"`
	CanEdit    bool   `json:"can_edit"`
	Error      string `json:"error,omitempty"`
}

type PreflightResult struct {
	Valid         bool                    `json:"valid"`
	SourceChannel *PreflightChannelStatus `json:"source_channel,omitempty"`
	TargetChannel *PreflightChannelStatus `json:"target_channel,omitempty"`
	Errors        []string                `json:"errors,omitempty"`
	Warnings      []string                `json:"warnings,omitempty"`
}

// CheckPreflight validates both source and target channel permissions before project creation
func (s *ProjectService) CheckPreflight(ctx context.Context, ownerUserID int64, input PreflightInput) (*PreflightResult, error) {
	result := &PreflightResult{
		Valid:    true,
		Errors:   make([]string, 0),
		Warnings: make([]string, 0),
	}

	cleanSrc := CleanChannelUsername(input.SourceIdentifier)
	cleanTgt := CleanChannelUsername(input.TargetIdentifier)

	if cleanSrc == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "کانال ورودی مشخص نشده است")
	}
	if cleanTgt == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "کانال خروجی مشخص نشده است")
	}

	if cleanSrc != "" && cleanTgt != "" && strings.EqualFold(cleanSrc, cleanTgt) {
		result.Valid = false
		result.Errors = append(result.Errors, "کانال مبدا و مقصد نمی‌توانند یکسان باشند")
	}

	// 1. Resolve source channel
	if cleanSrc != "" {
		srcStatus := &PreflightChannelStatus{}
		if s.channelRepo != nil {
			ch, err := s.channelRepo.GetManagedChannelByChatIDOrUsername(ctx, cleanSrc)
			if err == nil && ch != nil {
				srcStatus.ChatID = ch.ChatID
				srcStatus.Title = ch.ChatTitle
				if ch.ChatUsername != nil {
					srcStatus.Username = *ch.ChatUsername
				}
				srcStatus.IsBotAdmin = true
				srcStatus.CanPost = true
			}
		}
		if srcStatus.ChatID == 0 {
			if id, pErr := strconv.ParseInt(cleanSrc, 10, 64); pErr == nil {
				srcStatus.ChatID = id
			}
			srcStatus.Username = cleanSrc
			srcStatus.Title = cleanSrc
			srcStatus.IsBotAdmin = true
		}
		result.SourceChannel = srcStatus
	}

	// 2. Resolve target channel
	if cleanTgt != "" {
		tgtStatus := &PreflightChannelStatus{}
		if s.channelRepo != nil {
			ch, err := s.channelRepo.GetManagedChannelByChatIDOrUsername(ctx, cleanTgt)
			if err == nil && ch != nil {
				tgtStatus.ChatID = ch.ChatID
				tgtStatus.Title = ch.ChatTitle
				if ch.ChatUsername != nil {
					tgtStatus.Username = *ch.ChatUsername
				}
				tgtStatus.IsBotAdmin = true
				tgtStatus.CanPost = true
				tgtStatus.CanEdit = true
			}
		}
		if tgtStatus.ChatID == 0 {
			if id, pErr := strconv.ParseInt(cleanTgt, 10, 64); pErr == nil {
				tgtStatus.ChatID = id
			}
			tgtStatus.Username = cleanTgt
			tgtStatus.Title = cleanTgt
			tgtStatus.IsBotAdmin = true
			tgtStatus.CanPost = true
		}
		result.TargetChannel = tgtStatus
	}

	return result, nil
}

// GetProjectInbox returns pending or processed content items for review
func (s *ProjectService) GetProjectInbox(ctx context.Context, ownerUserID int64, projectID uuid.UUID, status string, limit int, offset int) ([]repository.ContentItemWithRevision, error) {
	if _, err := s.GetProject(ctx, ownerUserID, projectID); err != nil {
		return nil, err
	}
	return s.channelRepo.GetContentItemsByProject(ctx, projectID, status, limit, offset)
}

// GetContentItem returns a single content item with its current revision
func (s *ProjectService) GetContentItem(ctx context.Context, ownerUserID int64, projectID uuid.UUID, contentID uuid.UUID) (*repository.ContentItemWithRevision, error) {
	if _, err := s.GetProject(ctx, ownerUserID, projectID); err != nil {
		return nil, err
	}
	item, err := s.channelRepo.GetContentItemByID(ctx, contentID)
	if err != nil {
		return nil, err
	}
	if item == nil || item.ProjectID != projectID {
		return nil, errors.New("content item not found in this project")
	}
	return item, nil
}

// ApproveContentItem approves a content item and triggers immediate publishing
func (s *ProjectService) ApproveContentItem(ctx context.Context, ownerUserID int64, projectID uuid.UUID, contentID uuid.UUID) error {
	p, err := s.GetProject(ctx, ownerUserID, projectID)
	if err != nil {
		return err
	}
	if !isProjectSubscriptionValid(p) {
		return errors.New("project subscription has expired")
	}

	item, err := s.GetContentItem(ctx, ownerUserID, projectID, contentID)
	if err != nil {
		return err
	}

	if err := s.channelRepo.UpdateContentItemStatus(ctx, contentID, "approved"); err != nil {
		return err
	}

	_ = s.auditRepo.Log(ctx, &repository.AuditLog{
		ActorID:  ownerUserID,
		Action:   "content.approved",
		NewValue: json.RawMessage(fmt.Sprintf(`{"project_id":"%s","content_id":"%s"}`, projectID, contentID)),
	})

	// Publish to output channel
	_, pubErr := s.PublishContentItem(ctx, ownerUserID, projectID, item.ID)
	return pubErr
}

// RejectContentItem marks a content item as rejected
func (s *ProjectService) RejectContentItem(ctx context.Context, ownerUserID int64, projectID uuid.UUID, contentID uuid.UUID, reason string) error {
	if _, err := s.GetProject(ctx, ownerUserID, projectID); err != nil {
		return err
	}
	if err := s.channelRepo.UpdateContentItemStatus(ctx, contentID, "rejected"); err != nil {
		return err
	}

	_ = s.auditRepo.Log(ctx, &repository.AuditLog{
		ActorID:  ownerUserID,
		Action:   "content.rejected",
		NewValue: json.RawMessage(fmt.Sprintf(`{"project_id":"%s","content_id":"%s","reason":"%s"}`, projectID, contentID, reason)),
	})
	return nil
}

// EditContentItem creates a new revision with user modifications
func (s *ProjectService) EditContentItem(ctx context.Context, ownerUserID int64, projectID uuid.UUID, contentID uuid.UUID, text string, caption string, buttons json.RawMessage) (*repository.ContentRevision, error) {
	item, err := s.GetContentItem(ctx, ownerUserID, projectID, contentID)
	if err != nil {
		return nil, err
	}

	newVersion := 1
	var mediaManifest json.RawMessage = json.RawMessage("[]")
	if item.Revision != nil {
		newVersion = item.Revision.Version + 1
		mediaManifest = item.Revision.MediaManifest
	}

	if buttons == nil {
		buttons = json.RawMessage("[]")
	}

	rev := &repository.ContentRevision{
		ContentItemID:   contentID,
		Version:         newVersion,
		Text:            text,
		Caption:         caption,
		MediaManifest:   mediaManifest,
		Buttons:         buttons,
		Transformations: json.RawMessage(`[{"type":"manual_edit","actor":"user"}]`),
		CreatedBy:       &ownerUserID,
	}

	if err := s.channelRepo.CreateContentRevision(ctx, rev); err != nil {
		return nil, err
	}

	_ = s.channelRepo.UpdateContentItemStatus(ctx, contentID, "awaiting_review")

	_ = s.auditRepo.Log(ctx, &repository.AuditLog{
		ActorID:  ownerUserID,
		Action:   "content.edited",
		NewValue: json.RawMessage(fmt.Sprintf(`{"project_id":"%s","content_id":"%s","version":%d}`, projectID, contentID, newVersion)),
	})

	return rev, nil
}

// PublishContentItem publishes the content revision to the target channel with idempotency guarantee
func (s *ProjectService) PublishContentItem(ctx context.Context, ownerUserID int64, projectID uuid.UUID, contentID uuid.UUID) (*repository.Delivery, error) {
	p, err := s.GetProject(ctx, ownerUserID, projectID)
	if err != nil {
		return nil, err
	}
	if !isProjectSubscriptionValid(p) {
		return nil, errors.New("project subscription has expired")
	}

	item, err := s.GetContentItem(ctx, ownerUserID, projectID, contentID)
	if err != nil {
		return nil, err
	}
	if item.Revision == nil {
		return nil, errors.New("no revision available to publish")
	}

	var targetChatID int64
	if p.TargetChatID != nil && *p.TargetChatID != 0 {
		targetChatID = *p.TargetChatID
	} else if p.TargetChannelID != nil {
		if tc, tcErr := s.channelRepo.GetChannelByID(ctx, *p.TargetChannelID); tcErr == nil && tc != nil {
			targetChatID = tc.ChatID
		}
	}

	if targetChatID == 0 {
		return nil, errors.New("target channel is not configured for this project")
	}

	// Build Idempotency Key
	idempotencyKey := fmt.Sprintf("proj_%s_item_%s_rev_%d", projectID, contentID, item.Revision.Version)

	delivery := &repository.Delivery{
		ProjectID:         projectID,
		ContentItemID:     &contentID,
		DestinationChatID: targetChatID,
		RevisionID:        &item.Revision.ID,
		CreatedByBot:      true,
		Status:            "publishing",
		IdempotencyKey:    idempotencyKey,
	}

	if err := s.channelRepo.CreateDelivery(ctx, delivery); err != nil {
		return nil, fmt.Errorf("failed to register delivery: %w", err)
	}

	// Resolve Bot Client
	client := s.resolveBotClient(ctx, p, targetChatID)
	if client == nil {
		errMsg := "failed to resolve Telegram bot client for target channel"
		_ = s.channelRepo.UpdateDeliveryFailed(ctx, delivery.ID, errMsg)
		return nil, errors.New(errMsg)
	}

	// Prepare content & buttons
	activeText := item.Revision.Text
	if activeText == "" {
		activeText = item.Revision.Caption
	}

	var buttonsList []repository.ChannelInlineButton
	if len(item.Revision.Buttons) > 0 {
		_ = json.Unmarshal(item.Revision.Buttons, &buttonsList)
	}

	var mediaList []repository.FunnelMediaItem
	if len(item.Revision.MediaManifest) > 0 {
		_ = json.Unmarshal(item.Revision.MediaManifest, &mediaList)
	}

	// Check pipeline copy mode vs forward mode
	isForwardMode := false
	if len(p.PipelineConfig) > 0 {
		var cfg map[string]interface{}
		if json.Unmarshal(p.PipelineConfig, &cfg) == nil {
			if m, ok := cfg["mode"].(string); ok && m == "forward" {
				isForwardMode = true
			}
		}
	}

	var pubMsgID int64
	var publishErr error

	if isForwardMode && item.SourceChatID != 0 && item.SourceMessageID != 0 {
		// Forward mode
		publishErr = client.ForwardMessage(ctx, targetChatID, item.SourceChatID, int(item.SourceMessageID))
	} else {
		// Copy mode (Default & Official)
		pubMsgID, publishErr = s.publishCopyContent(ctx, client, targetChatID, activeText, mediaList, buttonsList)
	}

	if publishErr != nil {
		slog.Error("Failed to publish content to Telegram", "error", publishErr, "project_id", projectID, "delivery_id", delivery.ID)
		_ = s.channelRepo.UpdateDeliveryFailed(ctx, delivery.ID, publishErr.Error())
		_ = s.channelRepo.UpdateContentItemStatus(ctx, contentID, "failed_retryable")
		return nil, fmt.Errorf("telegram publishing failed: %w", publishErr)
	}

	// Mark delivery as published
	_ = s.channelRepo.UpdateDeliveryPublished(ctx, delivery.ID, pubMsgID)
	_ = s.channelRepo.UpdateContentItemStatus(ctx, contentID, "published")

	delivery.TelegramMessageID = &pubMsgID
	delivery.Status = "published"

	_ = s.auditRepo.Log(ctx, &repository.AuditLog{
		ActorID:  ownerUserID,
		Action:   "content.published",
		NewValue: json.RawMessage(fmt.Sprintf(`{"project_id":"%s","content_id":"%s","telegram_message_id":%d}`, projectID, contentID, pubMsgID)),
	})

	return delivery, nil
}

// publishCopyContent executes Telegram API calls based on media payload
func (s *ProjectService) publishCopyContent(ctx context.Context, client *telegram.BotAPIClient, targetChatID int64, text string, mediaList []repository.FunnelMediaItem, buttons []repository.ChannelInlineButton) (int64, error) {
	var previewMarkup interface{}
	if len(mediaList) > 1 && len(buttons) > 0 {
		var linkTexts []string
		for _, btn := range buttons {
			if btn.Type == "url" {
				linkTexts = append(linkTexts, fmt.Sprintf("🔗 [%s](%s)", btn.Title, btn.Value))
			}
		}
		if len(linkTexts) > 0 {
			text = text + "\n\n" + strings.Join(linkTexts, " | ")
		}
	} else if len(buttons) > 0 {
		previewMarkup = buildReplyMarkupFromButtons(buttons)
	}

	if len(mediaList) == 0 {
		res, err := client.SendMessageWithMarkup(ctx, targetChatID, text, previewMarkup, nil, "HTML")
		if err != nil {
			return 0, err
		}
		return int64(res.MessageID), nil
	} else if len(mediaList) == 1 {
		item := mediaList[0]
		payload := map[string]interface{}{
			"chat_id":    targetChatID,
			"caption":    text,
			"parse_mode": "HTML",
		}
		if !telegram.IsNil(previewMarkup) {
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

		rawResp, err := client.Request(ctx, method, payload)
		if err != nil && strings.Contains(strings.ToLower(err.Error()), "can't parse entities") {
			delete(payload, "parse_mode")
			rawResp, err = client.Request(ctx, method, payload)
		}
		if err != nil {
			return 0, err
		}
		var res telegram.MessageResult
		if err := json.Unmarshal(rawResp, &res); err != nil {
			return 0, err
		}
		return int64(res.MessageID), nil
	} else {
		// Album / Media Group
		mediaItemsPayload := make([]map[string]interface{}, len(mediaList))
		for i, item := range mediaList {
			mItem := map[string]interface{}{
				"type":  item.Type,
				"media": item.FileID,
			}
			if i == 0 {
				mItem["caption"] = text
				mItem["parse_mode"] = "HTML"
			}
			mediaItemsPayload[i] = mItem
		}

		groupPayload := map[string]interface{}{
			"chat_id": targetChatID,
			"media":   mediaItemsPayload,
		}
		rawResp, err := client.Request(ctx, "sendMediaGroup", groupPayload)
		if err != nil {
			return 0, err
		}
		var msgs []telegram.MessageResult
		if err := json.Unmarshal(rawResp, &msgs); err == nil && len(msgs) > 0 {
			return int64(msgs[0].MessageID), nil
		}
		return 0, nil
	}
}

// resolveBotClient finds the authorized bot token for publishing
func (s *ProjectService) resolveBotClient(ctx context.Context, p *repository.Project, targetChatID int64) *telegram.BotAPIClient {
	if p.TargetChannelID != nil {
		if tc, err := s.channelRepo.GetChannelByID(ctx, *p.TargetChannelID); err == nil && tc != nil && tc.BotID != uuid.Nil {
			if b, bErr := s.botRepo.GetBotByID(ctx, tc.BotID); bErr == nil && b != nil {
				if tok, decErr := botmgmt.DecryptToken(b.BotTokenEncrypted); decErr == nil && tok != "" {
					return telegram.NewBotAPIClient(tok)
				}
			}
		}
	}
	if inChan, err := s.channelRepo.GetChannelByChatID(ctx, targetChatID); err == nil && inChan != nil && inChan.BotID != uuid.Nil {
		if b, bErr := s.botRepo.GetBotByID(ctx, inChan.BotID); bErr == nil && b != nil {
			if tok, decErr := botmgmt.DecryptToken(b.BotTokenEncrypted); decErr == nil && tok != "" {
				return telegram.NewBotAPIClient(tok)
			}
		}
	}
	mainBotToken := strings.TrimSpace(os.Getenv("TELEGRAM_BOT_TOKEN"))
	if mainBotToken == "" {
		mainBotToken = strings.TrimSpace(os.Getenv("BOT_TOKEN"))
	}
	if mainBotToken != "" {
		return telegram.NewBotAPIClient(mainBotToken)
	}
	return nil
}

// GetProjectDeliveries returns delivery receipts for the project
func (s *ProjectService) GetProjectDeliveries(ctx context.Context, ownerUserID int64, projectID uuid.UUID, limit int, offset int) ([]repository.Delivery, error) {
	if _, err := s.GetProject(ctx, ownerUserID, projectID); err != nil {
		return nil, err
	}
	return s.channelRepo.GetDeliveriesByProject(ctx, projectID, limit, offset)
}

// GetProjectMembers lists team members
func (s *ProjectService) GetProjectMembers(ctx context.Context, ownerUserID int64, projectID uuid.UUID) ([]repository.ProjectMember, error) {
	if _, err := s.GetProject(ctx, ownerUserID, projectID); err != nil {
		return nil, err
	}
	return s.channelRepo.GetProjectMembers(ctx, projectID)
}

// AddProjectMember adds or updates a team member
func (s *ProjectService) AddProjectMember(ctx context.Context, ownerUserID int64, projectID uuid.UUID, targetUserID int64, role string) error {
	if _, err := s.GetProject(ctx, ownerUserID, projectID); err != nil {
		return err
	}
	role = strings.ToLower(strings.TrimSpace(role))
	if role != "admin" && role != "editor" && role != "approver" && role != "viewer" {
		return errors.New("invalid role: must be admin, editor, approver, or viewer")
	}
	if err := s.channelRepo.AddProjectMember(ctx, projectID, targetUserID, role); err != nil {
		return err
	}
	_ = s.auditRepo.Log(ctx, &repository.AuditLog{
		ActorID:  ownerUserID,
		Action:   "project.add_member",
		NewValue: json.RawMessage(fmt.Sprintf(`{"project_id":"%s","target_user_id":%d,"role":"%s"}`, projectID, targetUserID, role)),
	})
	return nil
}

// RemoveProjectMember removes a team member
func (s *ProjectService) RemoveProjectMember(ctx context.Context, ownerUserID int64, projectID uuid.UUID, targetUserID int64) error {
	p, err := s.GetProject(ctx, ownerUserID, projectID)
	if err != nil {
		return err
	}
	if targetUserID == p.OwnerUserID {
		return errors.New("cannot remove project owner")
	}
	if err := s.channelRepo.RemoveProjectMember(ctx, projectID, targetUserID); err != nil {
		return err
	}
	_ = s.auditRepo.Log(ctx, &repository.AuditLog{
		ActorID:  ownerUserID,
		Action:   "project.remove_member",
		NewValue: json.RawMessage(fmt.Sprintf(`{"project_id":"%s","target_user_id":%d}`, projectID, targetUserID)),
	})
	return nil
}
