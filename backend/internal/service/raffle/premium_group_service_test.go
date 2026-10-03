package raffle

import (
	"context"
	"fmt"
	"testing"
	"time"
)

func TestPremiumGroupService_AllowedUsers(t *testing.T) {
	svc := NewPremiumGroupService(nil)

	ctx := context.Background()

	// 1. Bot user should be allowed without any action
	botUser := UserCompact{
		ID:        12345,
		IsBot:     true,
		IsPremium: false,
		Username:  "sample_bot",
	}
	if err := svc.ProcessMemberJoinRealtime(ctx, nil, -100123456789, botUser); err != nil {
		t.Errorf("expected bot user to be allowed, got error: %v", err)
	}

	// 2. Telegram Premium user should be allowed without any action
	premiumUser := UserCompact{
		ID:        67890,
		IsBot:     false,
		IsPremium: true,
		Username:  "premium_user",
	}
	if err := svc.ProcessMemberJoinRealtime(ctx, nil, -100123456789, premiumUser); err != nil {
		t.Errorf("expected premium user to be allowed, got error: %v", err)
	}
}

func TestPremiumGroupService_JoinAttemptsRateLimiting(t *testing.T) {
	svc := NewPremiumGroupService(nil)

	chatID := int64(-100999999)
	userID := int64(88888)
	key := fmt.Sprintf("%d:%d", chatID, userID)

	now := time.Now()
	svc.joinAttempts.Store(key, &JoinAttemptRecord{
		Count:     3,
		FirstSeen: now,
		LastSeen:  now,
	})

	val, loaded := svc.joinAttempts.Load(key)
	if !loaded {
		t.Fatalf("expected join attempt record to be loaded")
	}
	rec := val.(*JoinAttemptRecord)
	if rec.Count != 3 {
		t.Errorf("expected count 3, got %d", rec.Count)
	}
}

func TestPremiumGroupService_HandleChatJoinRequestNilClient(t *testing.T) {
	svc := NewPremiumGroupService(nil)
	ctx := context.Background()

	user := UserCompact{
		ID:        11111,
		IsBot:     false,
		IsPremium: true,
	}

	err := svc.HandleChatJoinRequest(ctx, nil, -100123456, "Fragment Investors", user, 0, "en")
	if err == nil {
		t.Errorf("expected error when tgClient is nil, got nil")
	}
}
