package channelmgmt

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"ifragment-backend/internal/client/telegram"
	"ifragment-backend/internal/repository"
	"ifragment-backend/internal/service/botmgmt"

	"github.com/google/uuid"
)

type ProjectService struct {
	channelRepo *repository.ChannelRepo
	botRepo     *repository.BotRepo
	auditRepo   *repository.AuditRepo
}

func NewProjectService(
	channelRepo *repository.ChannelRepo,
	botRepo *repository.BotRepo,
	auditRepo *repository.AuditRepo,
) *ProjectService {
	return &ProjectService{
		channelRepo: channelRepo,
		botRepo:     botRepo,
		auditRepo:   auditRepo,
	}
}

type CreateProjectInput struct {
	Name                    string          `json:"name"`
	SourceChannelID         *uuid.UUID      `json:"source_channel_id,omitempty"`
	SourceChannelIdentifier string          `json:"source_channel_identifier,omitempty"`
	TargetChannelID         *uuid.UUID      `json:"target_channel_id,omitempty"`
	TargetChannelIdentifier string          `json:"target_channel_identifier,omitempty"`
	PipelineConfig          json.RawMessage `json:"pipeline_config,omitempty"`
}

type UpdateProjectInput struct {
	Name                    string          `json:"name"`
	SourceChannelID         *uuid.UUID      `json:"source_channel_id,omitempty"`
	SourceChannelIdentifier string          `json:"source_channel_identifier,omitempty"`
	TargetChannelID         *uuid.UUID      `json:"target_channel_id,omitempty"`
	TargetChannelIdentifier string          `json:"target_channel_identifier,omitempty"`
	PipelineConfig          json.RawMessage `json:"pipeline_config,omitempty"`
}

// CreateProject creates a new decoupled project with 72h trial or active subscription
func (s *ProjectService) CreateProject(ctx context.Context, ownerUserID int64, input CreateProjectInput) (*repository.Project, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		name = "پروژه انتقال هوشمند"
	}
	if len(name) > 100 {
		return nil, fmt.Errorf("project name cannot exceed 100 characters")
	}

	var sourceChatID, targetChatID *int64

	if input.SourceChannelID != nil && *input.SourceChannelID != uuid.Nil {
		ch, err := s.channelRepo.GetChannelByID(ctx, *input.SourceChannelID)
		if err != nil || ch == nil {
			return nil, fmt.Errorf("source channel not found")
		}
		sourceChatID = &ch.ChatID
	}

	if input.TargetChannelID != nil && *input.TargetChannelID != uuid.Nil {
		ch, err := s.channelRepo.GetChannelByID(ctx, *input.TargetChannelID)
		if err != nil || ch == nil {
			return nil, fmt.Errorf("target channel not found")
		}
		targetChatID = &ch.ChatID
	}

	// Check 72h trial status for this owner (1 per owner)
	usedTrial, err := s.channelRepo.HasUserUsedProjectTrial(ctx, ownerUserID)
	if err != nil {
		slog.Warn("Failed to check project trial status", "error", err)
	}

	trialUsed := false
	var trialEndsAt *time.Time
	status := "active"

	if !usedTrial {
		trialUsed = true
		t := time.Now().Add(72 * time.Hour)
		trialEndsAt = &t
	}

	var cfgMap map[string]interface{}
	if len(input.PipelineConfig) > 0 {
		_ = json.Unmarshal(input.PipelineConfig, &cfgMap)
	}
	if cfgMap == nil {
		cfgMap = make(map[string]interface{})
	}

	cleanSrcIdent := CleanChannelUsername(input.SourceChannelIdentifier)
	if cleanSrcIdent == "" {
		if src, ok := cfgMap["source_channel_identifier"].(string); ok {
			cleanSrcIdent = CleanChannelUsername(src)
		}
	}
	if cleanSrcIdent != "" {
		cfgMap["source_channel_identifier"] = cleanSrcIdent
		if sourceChatID == nil {
			if parsedID, err := strconv.ParseInt(cleanSrcIdent, 10, 64); err == nil {
				sourceChatID = &parsedID
			}
		}
	}

	cleanTgtIdent := CleanChannelUsername(input.TargetChannelIdentifier)
	if cleanTgtIdent == "" {
		if tgt, ok := cfgMap["target_channel_identifier"].(string); ok {
			cleanTgtIdent = CleanChannelUsername(tgt)
		}
	}
	if cleanTgtIdent != "" {
		cfgMap["target_channel_identifier"] = cleanTgtIdent
		if targetChatID == nil {
			if parsedID, err := strconv.ParseInt(cleanTgtIdent, 10, 64); err == nil {
				targetChatID = &parsedID
			}
		}
	}

	// Funnel architecture: auto_publish is false by default so post goes to bot for confirmation!
	if _, exists := cfgMap["auto_publish"]; !exists {
		cfgMap["auto_publish"] = false
	}

	configBytes, _ := json.Marshal(cfgMap)
	config := json.RawMessage(configBytes)

	p := &repository.Project{
		OwnerUserID:             ownerUserID,
		Name:                    name,
		Status:                  status,
		StarsSubscriptionActive: false,
		TrialUsed:               trialUsed,
		TrialEndsAt:             trialEndsAt,
		SourceChannelID:         input.SourceChannelID,
		TargetChannelID:         input.TargetChannelID,
		SourceChatID:            sourceChatID,
		TargetChatID:            targetChatID,
		PipelineConfig:          config,
	}

	if err := s.channelRepo.CreateProject(ctx, p); err != nil {
		return nil, fmt.Errorf("failed to create project: %w", err)
	}

	_ = s.auditRepo.Log(ctx, &repository.AuditLog{
		ActorID:  ownerUserID,
		Action:   "project.create",
		NewValue: config,
	})

	return p, nil
}

// ListProjects returns all projects owned by the user
func (s *ProjectService) ListProjects(ctx context.Context, ownerUserID int64) ([]*repository.Project, error) {
	return s.channelRepo.GetProjectsByOwner(ctx, ownerUserID)
}

// GetProject returns a single project by ID, verifying ownership
func (s *ProjectService) GetProject(ctx context.Context, ownerUserID int64, projectID uuid.UUID) (*repository.Project, error) {
	p, err := s.channelRepo.GetProjectByID(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, fmt.Errorf("project not found")
	}
	if p.OwnerUserID != ownerUserID {
		return nil, errors.New("access denied")
	}
	return p, nil
}

// UpdateProjectChannels modifies project channels and pipeline config in < 5 seconds without repayment or reconnect
func (s *ProjectService) UpdateProjectChannels(ctx context.Context, ownerUserID int64, projectID uuid.UUID, input UpdateProjectInput) (*repository.Project, error) {
	p, err := s.GetProject(ctx, ownerUserID, projectID)
	if err != nil {
		return nil, err
	}

	if input.Name != "" {
		p.Name = strings.TrimSpace(input.Name)
	}

	if input.SourceChannelID != nil {
		if *input.SourceChannelID == uuid.Nil {
			p.SourceChannelID = nil
			p.SourceChatID = nil
		} else {
			ch, err := s.channelRepo.GetChannelByID(ctx, *input.SourceChannelID)
			if err != nil || ch == nil {
				return nil, fmt.Errorf("source channel not found")
			}
			// Verify bot admin permission
			if err := s.verifyBotAdmin(ctx, ch); err != nil {
				return nil, fmt.Errorf("bot is not administrator in source channel: %w", err)
			}
			p.SourceChannelID = input.SourceChannelID
			p.SourceChatID = &ch.ChatID
		}
	}

	if input.TargetChannelID != nil {
		if *input.TargetChannelID == uuid.Nil {
			p.TargetChannelID = nil
			p.TargetChatID = nil
		} else {
			ch, err := s.channelRepo.GetChannelByID(ctx, *input.TargetChannelID)
			if err != nil || ch == nil {
				return nil, fmt.Errorf("target channel not found")
			}
			// Verify bot admin permission
			if err := s.verifyBotAdmin(ctx, ch); err != nil {
				return nil, fmt.Errorf("bot is not administrator in target channel: %w", err)
			}
			p.TargetChannelID = input.TargetChannelID
			p.TargetChatID = &ch.ChatID
		}
	}

	var cfgMap map[string]interface{}
	if len(p.PipelineConfig) > 0 {
		_ = json.Unmarshal(p.PipelineConfig, &cfgMap)
	}
	if cfgMap == nil {
		cfgMap = make(map[string]interface{})
	}

	if len(input.PipelineConfig) > 0 {
		var inputMap map[string]interface{}
		if err := json.Unmarshal(input.PipelineConfig, &inputMap); err == nil {
			for k, v := range inputMap {
				cfgMap[k] = v
			}
		}
	}

	if input.SourceChannelIdentifier != "" {
		cleanSrc := CleanChannelUsername(input.SourceChannelIdentifier)
		cfgMap["source_channel_identifier"] = cleanSrc
		if p.SourceChatID == nil {
			if parsedID, err := strconv.ParseInt(cleanSrc, 10, 64); err == nil {
				p.SourceChatID = &parsedID
			}
		}
	}

	if input.TargetChannelIdentifier != "" {
		cleanTgt := CleanChannelUsername(input.TargetChannelIdentifier)
		cfgMap["target_channel_identifier"] = cleanTgt
		if p.TargetChatID == nil {
			if parsedID, err := strconv.ParseInt(cleanTgt, 10, 64); err == nil {
				p.TargetChatID = &parsedID
			}
		}
	}

	configBytes, _ := json.Marshal(cfgMap)
	p.PipelineConfig = json.RawMessage(configBytes)

	if err := s.channelRepo.UpdateProject(ctx, p); err != nil {
		return nil, fmt.Errorf("failed to update project: %w", err)
	}

	_ = s.auditRepo.Log(ctx, &repository.AuditLog{
		ActorID:  ownerUserID,
		Action:   "project.update_channels",
		NewValue: p.PipelineConfig,
	})

	return s.channelRepo.GetProjectByID(ctx, projectID)
}

// ToggleProjectStatus pauses or resumes project pipeline execution
func (s *ProjectService) ToggleProjectStatus(ctx context.Context, ownerUserID int64, projectID uuid.UUID, active bool) (*repository.Project, error) {
	p, err := s.GetProject(ctx, ownerUserID, projectID)
	if err != nil {
		return nil, err
	}

	if active {
		p.Status = "active"
	} else {
		p.Status = "paused"
	}

	if err := s.channelRepo.UpdateProject(ctx, p); err != nil {
		return nil, err
	}

	return p, nil
}

// RenewProjectSubscription extends the Stars subscription for a project
func (s *ProjectService) RenewProjectSubscription(ctx context.Context, ownerUserID int64, projectID uuid.UUID, durationDays int) (*repository.Project, error) {
	p, err := s.GetProject(ctx, ownerUserID, projectID)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	var newExpiresAt time.Time
	if p.StarsSubscriptionActive && p.StarsExpiresAt != nil && p.StarsExpiresAt.After(now) {
		newExpiresAt = p.StarsExpiresAt.AddDate(0, 0, durationDays)
	} else {
		newExpiresAt = now.AddDate(0, 0, durationDays)
	}

	if err := s.channelRepo.UpdateProjectSubscription(ctx, projectID, "active", true, &newExpiresAt); err != nil {
		return nil, err
	}

	_ = s.auditRepo.Log(ctx, &repository.AuditLog{
		ActorID: ownerUserID,
		Action:  "project.renew_subscription",
	})

	return s.channelRepo.GetProjectByID(ctx, projectID)
}

// DeleteProject deletes a project
func (s *ProjectService) DeleteProject(ctx context.Context, ownerUserID int64, projectID uuid.UUID) error {
	_, err := s.GetProject(ctx, ownerUserID, projectID)
	if err != nil {
		return err
	}

	if err := s.channelRepo.DeleteProject(ctx, projectID); err != nil {
		return err
	}

	_ = s.auditRepo.Log(ctx, &repository.AuditLog{
		ActorID: ownerUserID,
		Action:  "project.delete",
	})

	return nil
}

func (s *ProjectService) verifyBotAdmin(ctx context.Context, ch *repository.ManagedChannel) error {
	bot, err := s.botRepo.GetBotByID(ctx, ch.BotID)
	if err != nil || bot == nil {
		return fmt.Errorf("channel bot not found")
	}

	token, err := botmgmt.DecryptToken(bot.BotTokenEncrypted)
	if err != nil || token == "" {
		return fmt.Errorf("failed to decrypt bot token")
	}

	tg := telegram.NewBotAPIClient(token)
	status, err := tg.GetChatMember(ctx, ch.ChatID, bot.BotID)
	if err != nil {
		// If check fails due to network, do not block strictly
		slog.Warn("Could not check bot status in chat", "chat_id", ch.ChatID, "error", err)
		return nil
	}

	if status != "administrator" && status != "creator" {
		return fmt.Errorf("bot is not administrator in channel (status: %s)", status)
	}

	return nil
}

// StartProjectExpirationWorker starts background check for expired project subscriptions
func (s *ProjectService) StartProjectExpirationWorker(ctx context.Context) {
	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			expired, err := s.channelRepo.GetExpiredProjects(ctx)
			if err != nil {
				slog.Error("Failed to fetch expired projects", "error", err)
				continue
			}
			for _, p := range expired {
				slog.Info("Project subscription expired, pausing pipeline", "project_id", p.ID, "owner_id", p.OwnerUserID)
				_ = s.channelRepo.UpdateProjectSubscription(ctx, p.ID, "expired", false, p.StarsExpiresAt)
				_ = s.auditRepo.Log(ctx, &repository.AuditLog{
					ActorID: 0,
					Action:  "project.auto_expired",
				})
			}
		}
	}
}
