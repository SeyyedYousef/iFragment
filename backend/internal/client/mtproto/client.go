package mtproto

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"

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

// NewRealClient creates a real MTProto client. Note: It needs to be connected/logged in before use.
func NewRealClient(appID int, appHash string) *RealClient {
	client := telegram.NewClient(appID, appHash, telegram.Options{})
	return &RealClient{
		client: client,
		api:    client.API(),
	}
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
func InitClient() Client {
	if os.Getenv("TG_APP_ID") != "" && os.Getenv("TG_APP_HASH") != "" {
		// In a real production setup, we would return a connected RealClient.
		// Since we need session management, we default to MockClient unless configured.
		slog.Info("MTProto credentials found, but session management is required. Falling back to Mock for now.")
	}
	return NewMockClient()
}
