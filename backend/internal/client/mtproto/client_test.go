package mtproto

import (
	"context"
	"os"
	"strings"
	"testing"

	"github.com/gotd/td/bin"
	"github.com/gotd/td/tg"
	"github.com/gotd/td/tgerr"
)

func TestInitClient_ProductionFailsWithoutCredentials(t *testing.T) {
	origAppEnv := os.Getenv("APP_ENV")
	origAppID := os.Getenv("TG_APP_ID")
	origAppHash := os.Getenv("TG_APP_HASH")
	origBotToken := os.Getenv("BOT_TOKEN")

	defer func() {
		os.Setenv("APP_ENV", origAppEnv)
		os.Setenv("TG_APP_ID", origAppID)
		os.Setenv("TG_APP_HASH", origAppHash)
		os.Setenv("BOT_TOKEN", origBotToken)
	}()

	os.Setenv("APP_ENV", "production")
	os.Setenv("TG_APP_ID", "")
	os.Setenv("TG_APP_HASH", "")
	os.Setenv("BOT_TOKEN", "")

	ctx := context.Background()
	client, err := InitClient(ctx)
	if err == nil {
		t.Fatalf("expected error in production when credentials are missing, got nil client: %v", client)
	}
}

func TestInitClient_DevelopmentAllowsMock(t *testing.T) {
	origAppEnv := os.Getenv("APP_ENV")
	origAppID := os.Getenv("TG_APP_ID")
	origAppHash := os.Getenv("TG_APP_HASH")
	origBotToken := os.Getenv("BOT_TOKEN")

	defer func() {
		os.Setenv("APP_ENV", origAppEnv)
		os.Setenv("TG_APP_ID", origAppID)
		os.Setenv("TG_APP_HASH", origAppHash)
		os.Setenv("BOT_TOKEN", origBotToken)
	}()

	os.Setenv("APP_ENV", "development")
	os.Setenv("TG_APP_ID", "")
	os.Setenv("TG_APP_HASH", "")
	os.Setenv("BOT_TOKEN", "")

	ctx := context.Background()
	client, err := InitClient(ctx)
	if err != nil {
		t.Fatalf("expected mock client to be permitted in development, got err: %v", err)
	}
	if client == nil {
		t.Fatalf("expected non-nil mock client in development")
	}
}

func TestInitClient_ProductionAllowsMockWhenExplicitlyEnabled(t *testing.T) {
	origAppEnv := os.Getenv("APP_ENV")
	origAppID := os.Getenv("TG_APP_ID")
	origAppHash := os.Getenv("TG_APP_HASH")
	origBotToken := os.Getenv("BOT_TOKEN")
	origAllowMock := os.Getenv("ALLOW_MOCK_CLIENT")

	defer func() {
		os.Setenv("APP_ENV", origAppEnv)
		os.Setenv("TG_APP_ID", origAppID)
		os.Setenv("TG_APP_HASH", origAppHash)
		os.Setenv("BOT_TOKEN", origBotToken)
		os.Setenv("ALLOW_MOCK_CLIENT", origAllowMock)
	}()

	os.Setenv("APP_ENV", "production")
	os.Setenv("ALLOW_MOCK_CLIENT", "true")
	os.Setenv("TG_APP_ID", "")
	os.Setenv("TG_APP_HASH", "")
	os.Setenv("BOT_TOKEN", "")

	ctx := context.Background()
	client, err := InitClient(ctx)
	if err != nil {
		t.Fatalf("expected mock client to be permitted in production when ALLOW_MOCK_CLIENT=true, got err: %v", err)
	}
	if client == nil {
		t.Fatalf("expected non-nil mock client in production when ALLOW_MOCK_CLIENT=true")
	}
}

type mockTGInvoker struct {
	accountCheckCalls int
	resolveCalls      int
	checkErr          error
	resolvePeer       *tg.ContactsResolvedPeer
	resolveErr        error
}

func (m *mockTGInvoker) Invoke(_ context.Context, input bin.Encoder, output bin.Decoder) error {
	switch input.(type) {
	case *tg.AccountCheckUsernameRequest:
		m.accountCheckCalls++
		return m.checkErr
	case *tg.ContactsResolveUsernameRequest:
		m.resolveCalls++
		if m.resolveErr != nil {
			return m.resolveErr
		}
		if m.resolvePeer != nil {
			var buf bin.Buffer
			if err := m.resolvePeer.Encode(&buf); err != nil {
				return err
			}
			return output.Decode(&buf)
		}
		return nil
	default:
		return nil
	}
}

func TestRealClient_CheckUsername_BotMethodInvalidFallbackAndLatch(t *testing.T) {
	inv := &mockTGInvoker{
		checkErr: tgerr.New(400, "BOT_METHOD_INVALID"),
		resolvePeer: &tg.ContactsResolvedPeer{
			Peer: &tg.PeerUser{UserID: 42},
			Users: []tg.UserClass{
				&tg.User{ID: 42, Username: "durov"},
			},
		},
	}
	c := &RealClient{api: tg.NewClient(inv)}

	// First call hits BOT_METHOD_INVALID, falls back to ResolveUsername -> StatusOccupied
	st, err := c.CheckUsername(context.Background(), "durov")
	if err != nil {
		t.Fatalf("unexpected error on bot fallback: %v", err)
	}
	if st != StatusOccupied {
		t.Fatalf("expected StatusOccupied, got %q", st)
	}
	if inv.accountCheckCalls != 1 || inv.resolveCalls != 1 {
		t.Fatalf("expected 1 check + 1 resolve call, got check=%d resolve=%d", inv.accountCheckCalls, inv.resolveCalls)
	}

	// Second call skips AccountCheckUsername directly because isBotSession latched
	inv.resolvePeer = nil
	inv.resolveErr = tgerr.New(400, "USERNAME_NOT_OCCUPIED")
	st, err = c.CheckUsername(context.Background(), "unclaimed_name_123")
	if err != nil {
		t.Fatalf("unexpected error for unclaimed handle: %v", err)
	}
	if st != StatusAvailable {
		t.Fatalf("expected StatusAvailable, got %q", st)
	}
	if inv.accountCheckCalls != 1 || inv.resolveCalls != 2 {
		t.Fatalf("expected latched bot session (check=1, resolve=2), got check=%d resolve=%d", inv.accountCheckCalls, inv.resolveCalls)
	}

	// 4-char collectible handle resolves USERNAME_NOT_OCCUPIED -> StatusPurchase
	st, err = c.CheckUsername(context.Background(), "bank")
	if err != nil {
		t.Fatalf("unexpected error for 4-char handle: %v", err)
	}
	if st != StatusPurchase {
		t.Fatalf("expected StatusPurchase for 4-char handle, got %q", st)
	}
}

func TestRealClient_CheckUsername_ResolveErrors(t *testing.T) {
	inv := &mockTGInvoker{
		checkErr:   tgerr.New(400, "BOT_METHOD_INVALID"),
		resolveErr: tgerr.New(400, "USERNAME_INVALID"),
	}
	c := &RealClient{api: tg.NewClient(inv)}

	st, err := c.CheckUsername(context.Background(), "bad_name")
	if err != nil {
		t.Fatalf("expected nil error for USERNAME_INVALID, got %v", err)
	}
	if st != StatusInvalid {
		t.Fatalf("expected StatusInvalid, got %q", st)
	}

	inv.resolveErr = tgerr.New(420, "FLOOD_WAIT_30")
	st, err = c.CheckUsername(context.Background(), "durov")
	if err == nil || !strings.Contains(err.Error(), "rate_limit_exceeded") {
		t.Fatalf("expected rate_limit_exceeded error, got status=%q err=%v", st, err)
	}
}

