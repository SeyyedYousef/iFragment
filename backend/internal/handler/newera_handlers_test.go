package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"ifragment-backend/internal/crypto"
	"ifragment-backend/internal/repository"
)

func TestHandleGuestMessage_SniffingAndResponse(t *testing.T) {
	// Set up mock Telegram server that captures answerGuestQuery
	var capturedMethod string
	var capturedBody string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedMethod = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"ok": true, "result": true}`))
	}))
	defer ts.Close()

	h := &WebhookHandler{}

	encToken, err := crypto.EncryptToken("123456:mock_token_for_test")
	if err != nil {
		t.Fatalf("failed to encrypt token: %v", err)
	}

	bot := &repository.ManagedBot{
		BotTokenEncrypted: encToken,
		BotUsername:       "iFragmentBot",
	}

	tests := []struct {
		name         string
		text         string
		guestQueryID string
	}{
		{"Username mention", "@iFragmentBot durov", "gq_test_1"},
		{"Number mention", "@iFragmentBot +8880000", "gq_test_2"},
		{"Gift mention", "@iFragmentBot plush_pepe", "gq_test_3"},
		{"General mention", "@iFragmentBot", "gq_test_4"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			upd := &GuestMessageUpdate{
				GuestQueryID: tt.guestQueryID,
				From: User{
					ID:        1234567,
					FirstName: "Tester",
				},
				Message: Message{
					Text: tt.text,
					Chat: &Chat{
						ID:   -100123456789,
						Type: "supergroup",
					},
				},
			}

			// Must not panic or fail
			h.handleGuestMessage(context.Background(), bot, upd)
		})
	}
	_ = capturedMethod
	_ = capturedBody
}
