package fragment

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFragmentScraperFixtures(t *testing.T) {
	tests := []struct {
		name               string
		statusCode         int
		htmlBody           string
		expectedStatus     Status
		expectedConfidence ParserConfidence
	}{
		{
			name:               "404 Not Found indicates available username",
			statusCode:         http.StatusNotFound,
			htmlBody:           "Not Found",
			expectedStatus:     StatusAvailable,
			expectedConfidence: ConfidenceExactSelector,
		},
		{
			name:               "Active auction DOM selector",
			statusCode:         http.StatusOK,
			htmlBody:           `<html><body><div class="tm-section-bid tm-auction-active">Current bid: 500 TON</div></body></html>`,
			expectedStatus:     StatusAuction,
			expectedConfidence: ConfidenceExactSelector,
		},
		{
			name:               "Buy now fixed price selector",
			statusCode:         http.StatusOK,
			htmlBody:           `<html><body><div class="tm-section-buy tm-buy-fixed">Buy for 1500 TON</div></body></html>`,
			expectedStatus:     StatusSale,
			expectedConfidence: ConfidenceExactSelector,
		},
		{
			name:               "Taken owner selector",
			statusCode:         http.StatusOK,
			htmlBody:           `<html><body><div class="tm-owner-address">EQD...123</div></body></html>`,
			expectedStatus:     StatusSold,
			expectedConfidence: ConfidenceExactSelector,
		},
		{
			name:               "OpenGraph meta tag auction fallback",
			statusCode:         http.StatusOK,
			htmlBody:           `<html><head><meta property="og:description" content="Telegram username on auction for TON"></head><body><div>Content</div></body></html>`,
			expectedStatus:     StatusAuction,
			expectedConfidence: ConfidenceOpenGraph,
		},
		{
			name:               "Text fallback for sold handle",
			statusCode:         http.StatusOK,
			htmlBody:           `<html><body><p>This username has been sold to an owner on Fragment</p></body></html>`,
			expectedStatus:     StatusSold,
			expectedConfidence: ConfidenceFallbackText,
		},
		{
			name:               "Corrupted unknown HTML response retains unknown status",
			statusCode:         http.StatusOK,
			htmlBody:           `<html><body><div>Unrecognized layout update from fragment</div></body></html>`,
			expectedStatus:     StatusUnknown,
			expectedConfidence: ConfidenceNone,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tc.statusCode)
				w.Write([]byte(tc.htmlBody))
			}))
			defer server.Close()

			client := NewClient()
			client.BaseURL = server.URL

			res, err := client.CheckUsernameWithConfidence(context.Background(), "testname")
			if tc.statusCode == http.StatusOK || tc.statusCode == http.StatusNotFound {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
			}

			if res.Status != tc.expectedStatus {
				t.Errorf("expected status %v, got %v", tc.expectedStatus, res.Status)
			}
			if res.Confidence != tc.expectedConfidence {
				t.Errorf("expected confidence %v, got %v", tc.expectedConfidence, res.Confidence)
			}
		})
	}
}
