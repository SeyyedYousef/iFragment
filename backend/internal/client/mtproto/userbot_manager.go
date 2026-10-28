package mtproto

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

type SessionNodeTelemetry struct {
	Phone          string    `json:"phone"`
	Healthy        bool      `json:"healthy"`
	InCooldown     bool      `json:"in_cooldown"`
	CooldownUntil  time.Time `json:"cooldown_until,omitempty"`
	TotalRequests  uint64    `json:"total_requests"`
	LastUsedAt     time.Time `json:"last_used_at,omitempty"`
}

type sessionNodeMetrics struct {
	cooldownUntil time.Time
	totalRequests uint64
	lastUsedAt    time.Time
}

type UserbotManager struct {
	mu         sync.RWMutex
	clients    map[string]*UserbotClient // phone number -> client
	metrics    map[string]*sessionNodeMetrics
	rrCounter  uint64
	msgHandler NewChannelMessageHandler
	errLogger  func(ctx context.Context, source, msg string) error
	appID      int
	appHash    string
}

func NewUserbotManager(appID int, appHash string, handler NewChannelMessageHandler, errLogger func(ctx context.Context, source, msg string) error) *UserbotManager {
	return &UserbotManager{
		clients:    make(map[string]*UserbotClient),
		metrics:    make(map[string]*sessionNodeMetrics),
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
	if _, exists := m.metrics[phone]; !exists {
		m.metrics[phone] = &sessionNodeMetrics{}
	}
	m.mu.Unlock()
	return nil
}

// RemoveClient stops a client and removes it from the pool
func (m *UserbotManager) RemoveClient(phone string) {
	m.mu.Lock()
	client, exists := m.clients[phone]
	if exists {
		delete(m.clients, phone)
		delete(m.metrics, phone)
	}
	m.mu.Unlock()

	if exists && client != nil && client.cancel != nil {
		// Gracefully stop the client, close sockets, and terminate background goroutines
		client.cancel()
		slog.Info("Userbot client removed and gracefully stopped", "phone", phone)
	}
}

// RecordFloodWait marks a session node as cooling down for the specified duration
func (m *UserbotManager) RecordFloodWait(phone string, waitDuration time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if meta, ok := m.metrics[phone]; ok {
		meta.cooldownUntil = time.Now().Add(waitDuration)
	}
}

// PickHealthyClient selects the next available session in Round-Robin order that is not in FloodWait cooldown
func (m *UserbotManager) PickHealthyClient() (string, *UserbotClient, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if len(m.clients) == 0 {
		return "", nil, errors.New("no active userbots available")
	}

	phones := make([]string, 0, len(m.clients))
	for p := range m.clients {
		phones = append(phones, p)
	}
	sort.Strings(phones)

	now := time.Now()
	n := uint64(len(phones))
	startIdx := atomic.AddUint64(&m.rrCounter, 1) % n

	for i := uint64(0); i < n; i++ {
		idx := (startIdx + i) % n
		phone := phones[idx]
		meta := m.metrics[phone]
		if meta != nil && now.Before(meta.cooldownUntil) {
			continue
		}
		if meta != nil {
			meta.totalRequests++
			meta.lastUsedAt = now
		}
		return phone, m.clients[phone], nil
	}

	// Fallback if all are in cooldown: pick the one whose cooldown expires soonest
	bestPhone := phones[0]
	for _, p := range phones[1:] {
		if m.metrics[p] != nil && m.metrics[bestPhone] != nil {
			if m.metrics[p].cooldownUntil.Before(m.metrics[bestPhone].cooldownUntil) {
				bestPhone = p
			}
		}
	}
	return bestPhone, m.clients[bestPhone], nil
}

// GetPoolTelemetry returns live telemetry for all sessions in the pool
func (m *UserbotManager) GetPoolTelemetry() []SessionNodeTelemetry {
	m.mu.RLock()
	defer m.mu.RUnlock()

	now := time.Now()
	out := make([]SessionNodeTelemetry, 0, len(m.clients))
	for phone := range m.clients {
		meta := m.metrics[phone]
		item := SessionNodeTelemetry{
			Phone:   phone,
			Healthy: true,
		}
		if meta != nil {
			item.TotalRequests = meta.totalRequests
			item.LastUsedAt = meta.lastUsedAt
			if now.Before(meta.cooldownUntil) {
				item.InCooldown = true
				item.Healthy = false
				item.CooldownUntil = meta.cooldownUntil
			}
		}
		out = append(out, item)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].Phone < out[j].Phone
	})
	return out
}

// JoinChannel tries to join the channel using Round-Robin healthy userbot selection.
func (m *UserbotManager) JoinChannel(ctx context.Context, identifier string) error {
	phone, client, err := m.PickHealthyClient()
	if err == nil && client != nil {
		if joinErr := client.JoinChannel(ctx, identifier); joinErr == nil {
			slog.Info("Successfully joined channel using primary rotated userbot", "phone", phone, "channel", identifier)
			return nil
		}
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	if len(m.clients) == 0 {
		return errors.New("no active userbots available")
	}

	var lastErr error
	for p, c := range m.clients {
		err := c.JoinChannel(ctx, identifier)
		if err == nil {
			slog.Info("Successfully joined channel using fallback userbot", "phone", p, "channel", identifier)
			return nil
		}
		slog.Warn("Userbot failed to join channel, trying next", "phone", p, "channel", identifier, "error", err)
		if m.errLogger != nil {
			_ = m.errLogger(ctx, "userbot", fmt.Sprintf("Failed to join channel %s: %v", identifier, err))
		}
		lastErr = err
	}

	return fmt.Errorf("all userbots failed to join channel: %w", lastErr)
}

