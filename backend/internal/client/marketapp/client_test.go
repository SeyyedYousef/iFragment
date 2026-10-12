package marketapp

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/shopspring/decimal"
)

func TestMarketApp_GetGiftFloor_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/gifts/onsale/" {
			t.Errorf("Unexpected path: %s", r.URL.Path)
			http.NotFound(w, r)
			return
		}
		if r.URL.Query().Get("model") != "plush_pepe" {
			t.Errorf("Unexpected model query: %s", r.URL.Query().Get("model"))
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"cursor": "cursor_123",
			"items": [
				{
					"address": "EQC1...",
					"name": "Plush Pepe #10",
					"collection_address": "EQCol...",
					"owner": "EQOwner...",
					"real_owner": "EQReal...",
					"min_bid": "14.50",
					"max_bid": "100.00",
					"status": "for_sale",
					"attributes": []
				},
				{
					"address": "EQC2...",
					"name": "Plush Pepe #11",
					"min_bid": "18.00",
					"status": "for_sale"
				}
			]
		}`))
	}))
	defer server.Close()

	client := &Client{
		BaseURL: server.URL,
		Tokens:  []string{"test_token"},
		HTTP:    server.Client(),
	}

	floor, count, err := client.GetGiftFloor(context.Background(), "plush_pepe")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	expectedFloor := decimal.NewFromFloat(14.50)
	if !floor.Equal(expectedFloor) {
		t.Errorf("Expected floor %s, got %s", expectedFloor, floor)
	}
	if count != 2 {
		t.Errorf("Expected count 2, got %d", count)
	}
}

func TestMarketApp_GetGiftFloor_Unauthorized(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"detail":"Invalid or expired token. Contact support @marketapp_chat","code":"AUTH_05"}`))
	}))
	defer server.Close()

	client := &Client{
		BaseURL: server.URL,
		Tokens:  []string{"expired_token"},
		HTTP:    server.Client(),
	}

	_, _, err := client.GetGiftFloor(context.Background(), "plush_pepe")
	if err == nil {
		t.Fatal("Expected error for 401 unauthorized, got nil")
	}
	if err != ErrUnauthorized {
		t.Errorf("Expected ErrUnauthorized, got: %v", err)
	}
}

func TestMarketApp_GetCollectionNFTsOnSale(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"cursor": null,
			"items": [
				{
					"address": "EQItem1...",
					"name": "@durov",
					"real_owner": "EQDurovOwner...",
					"min_bid": "50000.0",
					"status": "for_sale"
				}
			]
		}`))
	}))
	defer server.Close()

	client := &Client{
		BaseURL: server.URL,
		Tokens:  []string{"valid_token"},
		HTTP:    server.Client(),
	}

	item, err := client.GetItem(context.Background(), "durov")
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if item == nil {
		t.Fatal("Expected item @durov, got nil")
	}
	if item.Name != "@durov" {
		t.Errorf("Expected name @durov, got %s", item.Name)
	}
	if item.BuyNowPrice != 50000.0 {
		t.Errorf("Expected price 50000.0, got %f", item.BuyNowPrice)
	}
}
