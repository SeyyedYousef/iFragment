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

func TestGetHistoricalSales_DisambiguatesOwnershipFromBidHistory(t *testing.T) {
	htmlFixture := `<html><body>
		<section class="tm-section">
			<div class="tm-section-header"><h3 class="tm-section-header-text">Bid History</h3></div>
			<table class="tm-table">
				<thead><tr><th>Price</th><th>Date</th><th>From</th></tr></thead>
				<tbody>
					<tr>
						<td><div class="tm-value">500</div></td>
						<td><time datetime="2026-03-10T12:00:00Z">10 Mar 2026</time></td>
						<td>EQBidWallet1</td>
					</tr>
				</tbody>
			</table>
		</section>
		<section class="tm-section">
			<div class="tm-section-header"><h3 class="tm-section-header-text">Ownership History</h3></div>
			<table class="tm-table">
				<thead><tr><th>Sale price</th><th>Date</th><th>Buyer</th></tr></thead>
				<tbody>
					<tr>
						<td>Transferred</td>
						<td><time datetime="2026-02-15T10:00:00Z">15 Feb 2026</time></td>
						<td>EQBuyerWallet2</td>
					</tr>
					<tr>
						<td><div class="tm-value">12,500</div></td>
						<td><time datetime="2026-01-20T08:30:00Z">20 Jan 2026</time></td>
						<td>EQBuyerWallet1</td>
					</tr>
				</tbody>
			</table>
		</section>
	</body></html>`

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(htmlFixture))
	}))
	defer server.Close()

	client := NewClient()
	client.BaseURL = server.URL

	sales, err := client.GetHistoricalSales(context.Background(), "tony")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(sales) != 1 {
		t.Fatalf("expected exactly 1 completed sale from Ownership History (excluding Bid History and 'Transferred'), got %d", len(sales))
	}
	if sales[0].PriceTON != 12500 {
		t.Errorf("expected sale price 12500 TON, got %.2f", sales[0].PriceTON)
	}
}
