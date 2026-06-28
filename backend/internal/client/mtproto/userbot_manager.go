package mtproto

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
)

type UserbotManager struct {
	mu         sync.RWMutex
	clients    map[string]*UserbotClient // phone number -> client
	msgHandler NewChannelMessageHandler
	errLogger  func(ctx context.Context, source, msg string) error
	appID      int
	appHash    string
}

func NewUserbotManager(appID int, appHash string, handler NewChannelMessageHandler, errLogger func(ctx context.Context, source, msg string) error) *UserbotManager {
	return &UserbotManager{
		clients:    make(map[string]*UserbotClient),
		msgHandler: handler,
		errLogger:  errLogger,
		appID:      appID,
		appHash:    appHash,
	}
}

// AddClient starts a client and adds it to the pool
func (m *UserbotManager) AddClient(ctx context.Context, phone string) error {
	client, err := m.createClient(ctx, phone)
	if err != nil {
		return err
	}

	m.mu.Lock()
	m.clients[phone] = client
	m.mu.Unlock()
	return nil
}

// RemoveClient stops a client and removes it from the pool
func (m *UserbotManager) RemoveClient(phone string) {
	m.mu.Lock()
	client, exists := m.clients[phone]
	if exists {
		delete(m.clients, phone)
	}
	m.mu.Unlock()

	if exists && client != nil && client.cancel != nil {
		// Gracefully stop the client, close sockets, and terminate background goroutines
		client.cancel()
		slog.Info("Userbot client removed and gracefully stopped", "phone", phone)
	}
}

// JoinChannel tries to join the channel using the userbot with the least channels.
// For now, it just picks the first available userbot or tries them sequentially until one succeeds.
func (m *UserbotManager) JoinChannel(ctx context.Context, identifier string) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if len(m.clients) == 0 {
		return errors.New("no active userbots available")
	}

	var lastErr error
	for phone, client := range m.clients {
		err := client.JoinChannel(ctx, identifier)
		if err == nil {
			slog.Info("Successfully joined channel using userbot", "phone", phone, "channel", identifier)
			return nil
		}
		slog.Warn("Userbot failed to join channel, trying next", "phone", phone, "channel", identifier, "error", err)
		if m.errLogger != nil {
			_ = m.errLogger(ctx, "userbot", fmt.Sprintf("Failed to join channel %s: %v", identifier, err))
		}
		lastErr = err
	}

	return fmt.Errorf("all userbots failed to join channel: %w", lastErr)
}
