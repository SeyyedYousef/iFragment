package broadcaster

import (
	"testing"
	"time"
)

type mockCryptoProvider struct {
	price float64
}

func (m *mockCryptoProvider) GetPrice(symbol string) string {
	return "$4.25"
}

func (m *mockCryptoProvider) GetFloatPrice(symbol string) (float64, bool) {
	return m.price, true
}

func TestRecordPriceAndCleanup(t *testing.T) {
	b := &GramBroadcaster{
		cryptoSvc:    &mockCryptoProvider{price: 4.25},
		priceHistory: make([]PriceTick, 0),
	}

	now := time.Now().UTC()

	// Add an old record (25 hours ago)
	b.priceHistory = append(b.priceHistory, PriceTick{
		Price:     4.10,
		Timestamp: now.Add(-25 * time.Hour),
	})

	// Add a record within 24 hours (10 hours ago)
	b.priceHistory = append(b.priceHistory, PriceTick{
		Price:     4.20,
		Timestamp: now.Add(-10 * time.Hour),
	})

	// Run cleanup
	b.recordPriceAndCleanup(now)

	// Check length: 25h old record should be purged, 10h old + new tick should remain
	if len(b.priceHistory) != 2 {
		t.Fatalf("expected 2 price ticks after cleanup, got %d", len(b.priceHistory))
	}

	if b.priceHistory[0].Price != 4.20 {
		t.Errorf("expected oldest tick price to be 4.20, got %.2f", b.priceHistory[0].Price)
	}

	if b.priceHistory[1].Price != 4.25 {
		t.Errorf("expected newest tick price to be 4.25, got %.2f", b.priceHistory[1].Price)
	}
}

func TestExtractMessageID(t *testing.T) {
	jsonResp := []byte(`{"ok":true,"result":{"message_id":12345,"date":1600000000}}`)
	msgID := extractMessageID(jsonResp)
	if msgID != 12345 {
		t.Fatalf("expected message_id 12345, got %d", msgID)
	}
}
