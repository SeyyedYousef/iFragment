package mtproto

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"github.com/gotd/td/session"
	"github.com/gotd/td/telegram"
	"github.com/gotd/td/tg"
)

// Status represents the availability status of a username in Telegram
type Status string

const (
	StatusAvailable        Status = "available"
	StatusOccupied         Status = "occupied"
	StatusPurchase         Status = "purchase_available"
	StatusInvalid          Status = "invalid"
	StatusUnknown          Status = "unknown"
)

type Client interface {
	CheckUsername(ctx context.Context, username string) (Status, error)
	ResolveUsername(ctx context.Context, username string) (*tg.ContactsResolvedPeer, error)
}

type RealClient struct {
	client *telegram.Client
	api    *tg.Client
}

// NewRealClient creates a real MTProto client with session management.
func NewRealClient(ctx context.Context) (Client, error) {
	sessionDir := os.Getenv("TG_SESSION_DIR")
	if sessionDir == "" {
		sessionDir = "./sessions"
	}
	os.MkdirAll(sessionDir, 0755)
	
	storage := &session.FileStorage{Path: filepath.Join(sessionDir, "bot.session")}

	appID, _ := strconv.Atoi(os.Getenv("TG_APP_ID"))
	appHash := os.Getenv("TG_APP_HASH")
	botToken := os.Getenv("BOT_TOKEN")

	client := telegram.NewClient(appID, appHash, telegram.Options{
		SessionStorage: storage,
	})

	// Run client in background
	go func() {
		err := client.Run(context.Background(), func(ctx context.Context) error {
			if botToken != "" {
				if _, authErr := client.Auth().Bot(ctx, botToken); authErr != nil {
					slog.Error("MTProto Bot Auth failed", "err", authErr)
					return authErr
				}
			}
			<-ctx.Done()
			return ctx.Err()
		})
		if err != nil {
			slog.Error("MTProto client run failed", "err", err)
		}
	}()

	return &RealClient{
		client: client,
		api:    client.API(),
	}, nil
}

// CheckUsername uses MTProto account.checkUsername
func (c *RealClient) CheckUsername(ctx context.Context, username string) (Status, error) {
	ok, err := c.api.AccountCheckUsername(ctx, username)
	if err != nil {
		errStr := err.Error()
		if strings.Contains(errStr, "USERNAME_OCCUPIED") {
			return StatusOccupied, nil
		}
		if strings.Contains(errStr, "USERNAME_PURCHASE_AVAILABLE") {
			return StatusPurchase, nil
		}
		if strings.Contains(errStr, "USERNAME_INVALID") {
			return StatusInvalid, nil
		}
		if strings.Contains(errStr, "FLOOD_WAIT") {
			return StatusUnknown, fmt.Errorf("rate_limit_exceeded")
		}
		return StatusUnknown, err
	}
	if ok {
		return StatusAvailable, nil
	}
	// Fallback if ok is false but no error
	return StatusOccupied, nil
}

func (c *RealClient) ResolveUsername(ctx context.Context, username string) (*tg.ContactsResolvedPeer, error) {
	peer, err := c.api.ContactsResolveUsername(ctx, &tg.ContactsResolveUsernameRequest{Username: username})
	if err != nil {
		return nil, err
	}
	return peer, nil
}

// MockClient for local dev when no MTProto credentials are provided
type MockClient struct{}

func NewMockClient() *MockClient {
	return &MockClient{}
}

func (m *MockClient) CheckUsername(ctx context.Context, username string) (Status, error) {
	slog.Warn("Using MOCK MTProto Client for CheckUsername", "username", username)
	// Mock logic: lengths 4 or special are Purchase
	if len(username) == 4 {
		return StatusPurchase, nil
	}
	if username == "admin" || username == "telegram" || username == "durov" {
		return StatusOccupied, nil
	}
	// Let's pretend some are purchase available
	if username == "bank" || username == "auto" {
		return StatusPurchase, nil
	}
	return StatusAvailable, nil
}

func (m *MockClient) ResolveUsername(ctx context.Context, username string) (*tg.ContactsResolvedPeer, error) {
	return nil, fmt.Errorf("mock does not resolve")
}

// InitClient returns either a real or mock MTProto client based on env
func InitClient(ctx context.Context) Client {
	if os.Getenv("TG_APP_ID") != "" && os.Getenv("BOT_TOKEN") != "" {
		c, err := NewRealClient(ctx)
		if err == nil {
			slog.Info("Real MTProto client initialized")
			return c
		}
		slog.Error("MTProto init failed, falling back to mock", "err", err)
	} else {
		slog.Info("MTProto credentials missing, using MockClient")
	}
	return NewMockClient()
}
