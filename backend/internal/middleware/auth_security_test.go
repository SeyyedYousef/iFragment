package middleware

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func signInitDataForTest(t *testing.T, botToken, userJSON string, authDate int64) string {
	t.Helper()
	queryID := "AAH98765"
	dataCheckString := fmt.Sprintf("auth_date=%d\nquery_id=%s\nuser=%s", authDate, queryID, userJSON)
	hSecret := hmac.New(sha256.New, []byte("WebAppData"))
	hSecret.Write([]byte(botToken))
	hHash := hmac.New(sha256.New, hSecret.Sum(nil))
	hHash.Write([]byte(dataCheckString))
	sig := hex.EncodeToString(hHash.Sum(nil))
	return fmt.Sprintf("query_id=%s&user=%s&auth_date=%d&hash=%s",
		queryID, url.QueryEscape(userJSON), authDate, sig)
}

func TestVerifyInitDataAndExtractUserID_ProductionRejectsBypass(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("BYPASS_TELEGRAM_AUTH", "true")
	t.Setenv("BOT_TOKEN", "123456:test-secret-token")

	forged := `user=%7B%22id%22%3A999999%7D&auth_date=1700000000&hash=deadbeef`
	uid, err := VerifyInitDataAndExtractUserID(forged)
	if err == nil || uid != 0 {
		t.Fatalf("expected production bypass to be rejected, got uid=%d err=%v", uid, err)
	}
}

func TestOptionalAuthMiddleware_RejectsUnsignedInitData(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("BOT_TOKEN", "123456:test-secret-token")
	t.Setenv("BYPASS_TELEGRAM_AUTH", "")

	var sawUserCtx interface{}
	var sawUserID int64
	h := OptionalAuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawUserCtx = r.Context().Value(UserContextKey)
		sawUserID, _ = GetUserID(r.Context())
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/usernames/quick", nil)
	req.Header.Set("X-Telegram-Init-Data", `user=%7B%22id%22%3A777777%7D&hash=forged`)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 guest fallback, got %d", rec.Code)
	}
	if sawUserCtx != nil || sawUserID != 0 {
		t.Fatalf("expected forged X-Telegram-Init-Data to be ignored, got ctx=%v id=%d", sawUserCtx, sawUserID)
	}
}

func TestOptionalAuthMiddleware_AcceptsValidSignedInitData(t *testing.T) {
	botToken := "123456:test-secret-token"
	t.Setenv("APP_ENV", "production")
	t.Setenv("BOT_TOKEN", botToken)
	t.Setenv("TELEGRAM_BOT_TOKEN", botToken)
	t.Setenv("BYPASS_TELEGRAM_AUTH", "")

	var sawUserID int64
	h := OptionalAuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawUserID, _ = GetUserID(r.Context())
		w.WriteHeader(http.StatusOK)
	}))

	signed := signInitDataForTest(t, botToken, `{"id":555123,"username":"tester"}`, time.Now().Unix())
	req := httptest.NewRequest(http.MethodGet, "/api/v1/usernames/quick", nil)
	req.Header.Set("X-Telegram-Init-Data", signed)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if sawUserID != 555123 {
		t.Fatalf("expected verified user ID 555123, got %d", sawUserID)
	}
}

func TestServeAuthenticatedUser_EnforcesImpersonationWriteBlock(t *testing.T) {
	user := map[string]interface{}{
		"id":           int64(42),
		"impersonated": true,
	}
	ctx := context.WithValue(context.Background(), UserContextKey, user)
	ctx = context.WithValue(ctx, UserIDKey, int64(42))

	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	})

	reqPost := httptest.NewRequest(http.MethodPost, "/api/v1/profile/settings", nil).WithContext(ctx)
	recPost := httptest.NewRecorder()
	serveAuthenticatedUser(recPost, reqPost, next)
	if recPost.Code != http.StatusForbidden {
		t.Fatalf("expected impersonated POST to be blocked with 403, got %d", recPost.Code)
	}
	if nextCalled {
		t.Fatalf("expected next handler NOT to be called on impersonated write")
	}

	reqGet := httptest.NewRequest(http.MethodGet, "/api/v1/profile/settings", nil).WithContext(ctx)
	recGet := httptest.NewRecorder()
	serveAuthenticatedUser(recGet, reqGet, next)
	if recGet.Code != http.StatusOK || !nextCalled {
		t.Fatalf("expected impersonated GET to succeed, got code=%d called=%v", recGet.Code, nextCalled)
	}
}

func TestOptionalAuthMiddleware_DropsUnverifiableImpersonatedToken(t *testing.T) {
	t.Setenv("JWT_SECRET", "unit-test-secret-0123456789abcdef")
	cachedJWTSecret = ""
	ownerRepo = nil

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, &JWTClaims{
		UserID: 42,
		Role:   "user",
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        "imp-session-1",
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	})
	signed, err := token.SignedString([]byte("unit-test-secret-0123456789abcdef"))
	if err != nil {
		t.Fatalf("sign jwt: %v", err)
	}

	var sawUserID int64
	h := OptionalAuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sawUserID, _ = GetUserID(r.Context())
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/usernames/quick", nil)
	req.Header.Set("Authorization", "Bearer "+signed)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if sawUserID != 0 {
		t.Fatalf("expected impersonated JWT without active ownerRepo verification to drop to guest, got uid=%d", sawUserID)
	}
}
