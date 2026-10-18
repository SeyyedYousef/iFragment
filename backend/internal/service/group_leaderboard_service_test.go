package service

import (
	"context"
	"testing"
)

func TestGroupLeaderboard_UnconditionalPaidMessageRewards(t *testing.T) {
	svc := NewGroupLeaderboardService(nil, nil, nil)
	ctx := context.Background()
	userID := int64(777888999)

	// 1. Default 1x booster: every message grants 1 credit regardless of length, repetition, or rapid succession
	for i := 1; i <= 100; i++ {
		credits := svc.ComputeMessageRewardCredits(ctx, userID, 1)
		if credits != 1 {
			t.Fatalf("message #%d: expected 1 credit with zero daily cap or cooldown, got %d", i, credits)
		}
		// Record short message ("a"), slash command ("/ping"), duplicate text, empty media caption
		if err := svc.RecordGroupMessageWithStars(ctx, userID, "whale", "Whale", "", "fa", i, 1, "/ping"); err != nil {
			t.Fatalf("unexpected error recording message #%d: %v", i, err)
		}
	}

	// 2. Paid-star message with >1 Stars and 3x Whale Booster multiplier
	svc.setUserBoostMultiplier(ctx, userID, 3)
	if got := svc.ComputeMessageRewardCredits(ctx, userID, 1); got != 3 {
		t.Fatalf("expected 3 credits for 3x booster on 1-Star message, got %d", got)
	}
	if got := svc.ComputeMessageRewardCredits(ctx, userID, 5); got != 15 {
		t.Fatalf("expected 15 credits for 3x booster on 5-Star paid message, got %d", got)
	}
}
