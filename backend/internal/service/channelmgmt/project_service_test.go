package channelmgmt

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"ifragment-backend/internal/repository"
)

func TestProjectModelAndLifecycle(t *testing.T) {
	// Verify JSON serialization and defaults of Project model
	projectID := uuid.New()
	sourceID := uuid.New()
	targetID := uuid.New()
	var sourceChat int64 = -1001234567890
	var targetChat int64 = -1009876543210
	now := time.Now()

	p := &repository.Project{
		ID:                      projectID,
		OwnerUserID:             123456,
		Name:                    "VIP News Mirror",
		Status:                  "active",
		StarsSubscriptionActive: true,
		StarsExpiresAt:          &now,
		TrialUsed:               true,
		SourceChannelID:         &sourceID,
		TargetChannelID:         &targetID,
		SourceChatID:            &sourceChat,
		TargetChatID:            &targetChat,
		PipelineConfig:          json.RawMessage(`{"drop_media":false,"remove_ads":true}`),
		CreatedAt:               now,
		UpdatedAt:               now,
	}

	bytes, err := json.Marshal(p)
	if err != nil {
		t.Fatalf("unexpected error marshaling project: %v", err)
	}
	str := string(bytes)
	if !strings.Contains(str, "VIP News Mirror") || !strings.Contains(str, "active") || !strings.Contains(str, "remove_ads") {
		t.Errorf("project JSON missing expected fields: %s", str)
	}

	var unmarshaled repository.Project
	if err := json.Unmarshal(bytes, &unmarshaled); err != nil {
		t.Fatalf("unexpected error unmarshaling project: %v", err)
	}
	if unmarshaled.Name != p.Name {
		t.Errorf("expected name %s, got %s", p.Name, unmarshaled.Name)
	}
	if unmarshaled.OwnerUserID != p.OwnerUserID {
		t.Errorf("expected owner %d, got %d", p.OwnerUserID, unmarshaled.OwnerUserID)
	}
	if unmarshaled.SourceChatID == nil || *unmarshaled.SourceChatID != sourceChat {
		t.Errorf("expected source chat %d, got %v", sourceChat, unmarshaled.SourceChatID)
	}
}

func TestProjectServiceInstantiation(t *testing.T) {
	svc := NewProjectService(nil, nil, nil)
	if svc == nil {
		t.Fatal("expected non-nil ProjectService")
	}

	// Verify project expiration worker exits cleanly on context cancel
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately
	svc.StartProjectExpirationWorker(ctx)
}
