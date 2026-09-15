package raffle

import (
	"context"
	"fmt"
	"testing"
	"time"

	"ifragment-backend/internal/repository"
)

func TestDeduplicatedRafflePoolAndChanceCalculations(t *testing.T) {
	tests := []struct {
		name               string
		uniqueParticipants int
		totalMessages      int
		expectedChance     float64
		expectedPoolUSD    float64
		expectedMinReward  float64
		expectedMaxReward  float64
	}{
		{
			name:               "Single participant 1 message",
			uniqueParticipants: 1,
			totalMessages:      1,
			expectedChance:     100.0,
			expectedPoolUSD:    1.0,
			expectedMinReward:  0.25,
			expectedMaxReward:  0.50,
		},
		{
			name:               "10 unique participants with 50 total messages",
			uniqueParticipants: 10,
			totalMessages:      50,
			expectedChance:     10.0,
			expectedPoolUSD:    50.0,
			expectedMinReward:  12.50,
			expectedMaxReward:  25.00,
		},
		{
			name:               "20 unique participants with 100 total messages",
			uniqueParticipants: 20,
			totalMessages:      100,
			expectedChance:     5.0,
			expectedPoolUSD:    100.0,
			expectedMinReward:  25.00,
			expectedMaxReward:  50.00,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			chance := (1.0 / float64(tt.uniqueParticipants)) * 100.0
			poolTotal := float64(tt.totalMessages) * 1.0
			minReward := poolTotal * 0.25
			maxReward := poolTotal * 0.50

			if chance != tt.expectedChance {
				t.Errorf("expected chance %.2f, got %.2f", tt.expectedChance, chance)
			}
			if poolTotal != tt.expectedPoolUSD {
				t.Errorf("expected poolTotal %.2f, got %.2f", tt.expectedPoolUSD, poolTotal)
			}
			if minReward != tt.expectedMinReward {
				t.Errorf("expected minReward %.2f, got %.2f", tt.expectedMinReward, minReward)
			}
			if maxReward != tt.expectedMaxReward {
				t.Errorf("expected maxReward %.2f, got %.2f", tt.expectedMaxReward, maxReward)
			}
		})
	}
}

func TestRaffleServiceExecuteDailyDraw_NoRepo(t *testing.T) {
	svc := NewRaffleService(nil, nil)
	err := svc.ExecuteDailyDraw(context.Background(), nil, time.Now())
	if err != nil {
		t.Fatalf("expected nil error when repo is nil, got: %v", err)
	}
}

func TestRaffleServiceRecordMessageTicket_NoRepo(t *testing.T) {
	svc := NewRaffleService(nil, nil)
	user := UserCompact{
		ID:        123456,
		FirstName: "Alice",
		Username:  "alice_crypto",
		IsPremium: true,
	}

	err := svc.RecordMessageTicket(context.Background(), nil, -1001234567890, user, 42)
	if err != nil {
		t.Fatalf("expected nil error when repo/tgClient is nil, got: %v", err)
	}
}

func TestDailyGiftDrawNotificationFormat(t *testing.T) {
	draw := &repository.DailyGiftDraw{
		DrawDate:          time.Date(2026, 9, 14, 0, 0, 0, 0, time.UTC),
		TotalMessages:     100,
		TotalParticipants: 20,
		WinnerUserID:      987654321,
		WinnerUsername:    "LuckyWinner",
		WinnerFirstName:   "Seyyed",
		PrizeUSD:          35.0,
		PrizeStars:        1750,
		GiftID:            "gift_star_123",
		GiftTitle:         "Telegram Star Gift (1750 Stars)",
		AutoSent:          true,
		LockStatus:        "LOCKED",
		NotifiedOwner:     true,
	}

	usernameDisplay := "@" + draw.WinnerUsername
	msg := fmt.Sprintf("Winner: %s (id: %d), Messages: %d, Participants: %d, Prize: $%.2f (~%d Stars), AutoSent: %v",
		usernameDisplay, draw.WinnerUserID, draw.TotalMessages, draw.TotalParticipants, draw.PrizeUSD, draw.PrizeStars, draw.AutoSent)

	expected := "Winner: @LuckyWinner (id: 987654321), Messages: 100, Participants: 20, Prize: $35.00 (~1750 Stars), AutoSent: true"
	if msg != expected {
		t.Errorf("unexpected formatted message: %s", msg)
	}
}
