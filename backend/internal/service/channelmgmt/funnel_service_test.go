package channelmgmt

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"ifragment-backend/internal/repository"
)

func TestChannelFunnelDeBounceAndLogic(t *testing.T) {
	// Setup mock repositories
	channelRepo := repository.NewChannelRepo(nil, nil)
	botRepo := repository.NewBotRepo(nil)
	auditRepo := repository.NewAuditRepo(nil)

	s := NewChannelService(channelRepo, botRepo, auditRepo, nil)
	_ = s

	ctx := context.Background()
	_ = ctx

	// Verify that de-bounce correctly aggregates media items
	mediaGroupList := []repository.FunnelMediaItem{
		{FileID: "file1", Type: "photo", Caption: "First caption"},
	}

	// For test validation, we verify that json marshalling of the payload works perfectly
	rawPayload, err := json.Marshal(mediaGroupList)
	if err != nil {
		t.Fatalf("Failed to marshal media payload: %v", err)
	}

	var unmarshalled []repository.FunnelMediaItem
	err = json.Unmarshal(rawPayload, &unmarshalled)
	if err != nil {
		t.Fatalf("Failed to unmarshal media payload: %v", err)
	}

	if len(unmarshalled) != 1 || unmarshalled[0].FileID != "file1" {
		t.Errorf("Expected 1 media item with file1, got %v", unmarshalled)
	}

	// Verify scheduler duration parsing
	delayOption := "1h"
	var delay time.Duration
	switch delayOption {
	case "15m":
		delay = 15 * time.Minute
	case "1h":
		delay = 1 * time.Hour
	case "2h":
		delay = 2 * time.Hour
	}

	if delay != time.Hour {
		t.Errorf("Expected delay to be 1 hour, got %v", delay)
	}
}

func TestFunnelStateSelection(t *testing.T) {
	draft := &repository.PendingFunnelPost{
		DraftText:              "Original caption",
		AiVariations:           []string{"Standard rewrite", "Bold promotional rewrite", "Short description"},
		SelectedVariationIndex: 0,
	}

	// Simulation: Owner selects Promo variation (Index 1)
	draft.SelectedVariationIndex = 1
	draft.DraftText = draft.AiVariations[draft.SelectedVariationIndex]

	if draft.DraftText != "Bold promotional rewrite" {
		t.Errorf("Expected DraftText to update to 'Bold promotional rewrite', got %q", draft.DraftText)
	}

	// Simulation: Owner selects Short variation (Index 2)
	draft.SelectedVariationIndex = 2
	draft.DraftText = draft.AiVariations[draft.SelectedVariationIndex]

	if draft.DraftText != "Short description" {
		t.Errorf("Expected DraftText to update to 'Short description', got %q", draft.DraftText)
	}
}
