package tonapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newTestTonAPIClient(serverURL string) *Client {
	return &Client{
		BaseURL: serverURL,
		HTTP:    http.DefaultClient,
	}
}

func TestAuditWalletSecurity_W5Safe(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/accounts/"):
			_, _ = w.Write([]byte(`{"address":"0:abc","balance":25000000000,"status":"active","interfaces":["wallet_v5r1"],"is_scam":false}`))
		case strings.HasSuffix(r.URL.Path, "/methods/is_signature_allowed"):
			_, _ = w.Write([]byte(`{"success":true,"exit_code":0,"stack":[{"type":"num","num":"-0x1"}],"decoded":{"is_signature_allowed":true}}`))
		case strings.HasSuffix(r.URL.Path, "/methods/get_extensions"):
			_, _ = w.Write([]byte(`{"success":true,"exit_code":0,"stack":[{"type":"null"}],"decoded":{"extensions":[]}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	c := newTestTonAPIClient(srv.URL)
	audit, err := c.AuditWalletSecurity(context.Background(), "UQCI9IKB-DInGpUeC5WpUhbUvpK-J6mOZhZ_sIc_ndJZih4i")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if audit.SecurityLevel != "safe" {
		t.Fatalf("expected safe, got %s", audit.SecurityLevel)
	}
	if audit.WalletVersion != "wallet_v5r1" {
		t.Fatalf("expected wallet_v5r1, got %s", audit.WalletVersion)
	}
	if audit.SignatureAllowed == nil || !*audit.SignatureAllowed {
		t.Fatalf("expected signature_allowed=true")
	}
	if audit.HasExtensions || audit.ExtensionsCount != 0 {
		t.Fatalf("expected 0 extensions, got has=%v count=%d", audit.HasExtensions, audit.ExtensionsCount)
	}
	if audit.BalanceTON != 25 {
		t.Fatalf("expected balance 25 TON, got %v", audit.BalanceTON)
	}
}

func TestAuditWalletSecurity_W5ExtensionCaution(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/accounts/"):
			_, _ = w.Write([]byte(`{"address":"0:abc","balance":1000000000,"status":"active","interfaces":["wallet_v5r1"],"is_scam":false}`))
		case strings.HasSuffix(r.URL.Path, "/methods/is_signature_allowed"):
			_, _ = w.Write([]byte(`{"success":true,"exit_code":0,"stack":[{"type":"num","num":"-0x1"}]}`))
		case strings.HasSuffix(r.URL.Path, "/methods/get_extensions"):
			_, _ = w.Write([]byte(`{"success":true,"exit_code":0,"stack":[{"type":"cell","cell":"te6ccg=="}],"decoded":{"extensions":["0:deadbeef00000000000000000000000000000000000000000000000000000001"]}}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	c := newTestTonAPIClient(srv.URL)
	audit, err := c.AuditWalletSecurity(context.Background(), "UQCI9IKB-DInGpUeC5WpUhbUvpK-J6mOZhZ_sIc_ndJZih4i")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if audit.SecurityLevel != "caution" {
		t.Fatalf("expected caution, got %s", audit.SecurityLevel)
	}
	if !audit.HasExtensions || audit.ExtensionsCount != 1 {
		t.Fatalf("expected 1 active extension, got has=%v count=%d", audit.HasExtensions, audit.ExtensionsCount)
	}
}

func TestAuditWalletSecurity_W5SignatureLockedCritical(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasPrefix(r.URL.Path, "/accounts/"):
			_, _ = w.Write([]byte(`{"address":"0:abc","balance":0,"status":"active","interfaces":["wallet_v5r1"],"is_scam":false}`))
		case strings.HasSuffix(r.URL.Path, "/methods/is_signature_allowed"):
			_, _ = w.Write([]byte(`{"success":true,"exit_code":0,"stack":[{"type":"num","num":"0x0"}]}`))
		case strings.HasSuffix(r.URL.Path, "/methods/get_extensions"):
			_, _ = w.Write([]byte(`{"success":true,"exit_code":0,"stack":[{"type":"cell","cell":"te6ccg=="}]}`))
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	c := newTestTonAPIClient(srv.URL)
	audit, err := c.AuditWalletSecurity(context.Background(), "UQCI9IKB-DInGpUeC5WpUhbUvpK-J6mOZhZ_sIc_ndJZih4i")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if audit.SecurityLevel != "critical" {
		t.Fatalf("expected critical, got %s", audit.SecurityLevel)
	}
	if audit.SignatureAllowed == nil || *audit.SignatureAllowed {
		t.Fatalf("expected signature_allowed=false")
	}
}

func TestAuditWalletSecurity_ScamCritical(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/accounts/") {
			_, _ = w.Write([]byte(`{"address":"0:scam","balance":5000000000,"status":"active","interfaces":["wallet_v4r2"],"is_scam":true}`))
			return
		}
		_, _ = w.Write([]byte(`{"success":true,"exit_code":0,"stack":[{"type":"null"}]}`))
	}))
	defer srv.Close()

	c := newTestTonAPIClient(srv.URL)
	audit, err := c.AuditWalletSecurity(context.Background(), "UQCI9IKB-DInGpUeC5WpUhbUvpK-J6mOZhZ_sIc_ndJZih4i")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if audit.SecurityLevel != "critical" || !audit.IsScam {
		t.Fatalf("expected critical scam, got level=%s is_scam=%v", audit.SecurityLevel, audit.IsScam)
	}
}
