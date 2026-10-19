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
		if gotAuth := r.Header.Get("Authorization"); gotAuth != "test_token" {
			t.Errorf("Expected raw Authorization token 'test_token', got %q", gotAuth)
		}
		if r.URL.Path == "/collections/gifts/" {
			http.NotFound(w, r)
			return
		}
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

func TestMarketApp_GetGiftFloor_FromCollectionsEndpoint(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/collections/gifts/" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`[
				{
					"name": "Plush Pepe",
					"address": "EQBG-g6ahkAUGWpefWbx-D_9sQ8oWbvy6puuq78U2c4NUDFS",
					"extra_data": {
						"items": 2861,
						"floor": "1950.5",
						"rent_floor": "12.0",
						"volume7d": "45200.0",
						"volume30d": "182000.0",
						"owners": 1940,
						"on_sale_all": 142,
						"on_sale_onchain": 87
					}
				}
			]`))
			return
		}
		http.NotFound(w, r)
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
	if !floor.Equal(decimal.NewFromFloat(1950.5)) {
		t.Errorf("Expected floor 1950.5, got %s", floor)
	}
	if count != 87 {
		t.Errorf("Expected on-sale count 87, got %d", count)
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
