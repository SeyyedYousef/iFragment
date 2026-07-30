package payment

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCreateInvoiceLink_Success(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/botTEST_TOKEN/createInvoiceLink" {
			t.Fatalf("unexpected URL path: %s", r.URL.Path)
		}
		var req InvoiceRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("failed to decode request body: %v", err)
		}
		if req.Currency != "XTR" {
			t.Errorf("expected currency XTR, got %s", req.Currency)
		}
		if len(req.Prices) != 1 || req.Prices[0].Amount != 500 {
			t.Errorf("expected amount 500, got %v", req.Prices)
		}

		resp := InvoiceResponse{
			OK:     true,
			Result: "https://t.me/$invoice_link_123",
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer ts.Close()

	svc := &StarsService{
		BotToken: "TEST_TOKEN",
		HTTP:     ts.Client(),
	}
	_ = svc
}

func TestInvoiceRequestSerialization(t *testing.T) {
	req := InvoiceRequest{
		Title:       "Test Sub",
		Description: "1 Month Sub",
		Payload:     "sub_123",
		Currency:    "XTR",
		Prices:      []Price{{Label: "Test Sub", Amount: 250}},
	}
	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("json.Marshal failed: %v", err)
	}
	var decoded map[string]interface{}
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("json.Unmarshal failed: %v", err)
	}
	if decoded["currency"] != "XTR" {
		t.Errorf("expected currency XTR, got %v", decoded["currency"])
	}
}
