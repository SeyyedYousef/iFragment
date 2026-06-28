package mtproto

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gotd/td/session"
	"github.com/gotd/td/telegram"
	"github.com/gotd/td/telegram/auth"
	"github.com/gotd/td/telegram/updates"
	updhook "github.com/gotd/td/telegram/updates/hook"
	"github.com/gotd/td/tg"
	"github.com/gotd/td/tgerr"
)

type UserbotClient struct {
	client     *telegram.Client
	api        *tg.Client
	dispatcher tg.UpdateDispatcher
	gaps       *updates.Manager
	cancel     context.CancelFunc
}

type NewChannelMessageHandler func(ctx context.Context, e tg.Entities, msg *tg.Message)

// createClient creates an MTProto client designed to run as a Userbot (personal account).
func (m *UserbotManager) createClient(ctx context.Context, phone string) (*UserbotClient, error) {
	sessionDir := os.Getenv("TG_SESSION_DIR")
	if sessionDir == "" {
		sessionDir = "./sessions"
	}
	// Store sessions with phone number prefix
	sessionPath := filepath.Join(sessionDir, fmt.Sprintf("userbot_%s.session", phone))

	storage := &session.FileStorage{Path: sessionPath}

	dispatcher := tg.NewUpdateDispatcher()
	gaps := updates.New(updates.Config{
		Handler: dispatcher,
	})

	if m.msgHandler != nil {
		dispatcher.OnNewChannelMessage(func(ctx context.Context, e tg.Entities, update *tg.UpdateNewChannelMessage) error {
			msg, ok := update.Message.(*tg.Message)
			if ok {
				m.msgHandler(ctx, e, msg)
			}
			return nil
		})
	}

	client := telegram.NewClient(m.appID, m.appHash, telegram.Options{
		SessionStorage: storage,
		UpdateHandler:  gaps,
		Middlewares: []telegram.Middleware{
			updhook.UpdateHook(gaps.Handle),
		},
	})

	clientCtx, cancel := context.WithCancel(ctx)

	uc := &UserbotClient{
		client:     client,
		api:        client.API(),
		dispatcher: dispatcher,
		gaps:       gaps,
		cancel:     cancel,
	}

	// Start the client in the background
	go func() {
		defer cancel() // Clean up resources
		
		err := client.Run(clientCtx, func(runCtx context.Context) error {
			status, err := client.Auth().Status(runCtx)
			if err != nil {
				return err
			}
			if !status.Authorized {
				slog.Error("Userbot session is not authorized", "phone", phone)
				return errors.New("unauthorized userbot session")
			}

			slog.Info("Userbot client is running and authorized", "phone", phone)

			// Tell the gaps manager about our authentication
			user, err := client.Self(runCtx)
			if err != nil {
				return err
			}
			return gaps.Run(runCtx, client.API(), user.ID, updates.AuthOptions{
				IsBot: false,
				OnStart: func(ctx context.Context) {
					slog.Info("Userbot updates manager started", "phone", phone)
				},
			})
		})
		if err != nil && !errors.Is(err, context.Canceled) {
			slog.Error("Userbot client run failed or disconnected", "phone", phone, "err", err)
		}
		
		// Ensure dead client is removed from the manager to prevent zombie state
		m.RemoveClient(phone)
	}()

	return uc, nil
}

// InteractiveLogin is used by the CLI tool to perform the login flow
func InteractiveLogin(ctx context.Context, flow auth.Flow) error {
	sessionDir := os.Getenv("TG_SESSION_DIR")
	if sessionDir == "" {
		sessionDir = "./sessions"
	}
	if err := os.MkdirAll(sessionDir, 0700); err != nil {
		return fmt.Errorf("failed to create session directory: %w", err)
	}

	storage := &session.FileStorage{Path: filepath.Join(sessionDir, "userbot.session")}

	appIDStr := os.Getenv("TG_APP_ID")
	appID, _ := strconv.Atoi(appIDStr)
	appHash := os.Getenv("TG_APP_HASH")

	client := telegram.NewClient(appID, appHash, telegram.Options{
		SessionStorage: storage,
	})

	return client.Run(ctx, func(runCtx context.Context) error {
		if err := client.Auth().IfNecessary(runCtx, flow); err != nil {
			return err
		}

		status, err := client.Auth().Status(runCtx)
		if err != nil {
			return err
		}
		if status.Authorized {
			fmt.Println("Successfully logged in!")
			user, err := client.Self(runCtx)
			if err == nil {
				fmt.Printf("Logged in as: %s (@%s)\n", user.FirstName, user.Username)
			}
		}
		return nil
	})
}

// AuthSendCode initiates the stateless login flow by sending a code to the phone number.
func AuthSendCode(ctx context.Context, phone string) (string, error) {
	sessionDir := os.Getenv("TG_SESSION_DIR")
	if sessionDir == "" {
		sessionDir = "./sessions"
	}
	os.MkdirAll(sessionDir, 0700)
	storage := &session.FileStorage{Path: filepath.Join(sessionDir, fmt.Sprintf("userbot_%s.session", phone))}

	appIDStr := os.Getenv("TG_APP_ID")
	appHash := os.Getenv("TG_APP_HASH")

	if appIDStr == "" || appHash == "" {
		return "", errors.New("برای ورود با حساب کاربری، ابتدا باید TG_APP_ID و TG_APP_HASH را در فایل env سرور تنظیم کنید. این مقادیر را از my.telegram.org دریافت کنید.")
	}
	appID, _ := strconv.Atoi(appIDStr)

	client := telegram.NewClient(appID, appHash, telegram.Options{SessionStorage: storage})

	var phoneCodeHash string
	err := client.Run(ctx, func(runCtx context.Context) error {
		res, err := client.Auth().SendCode(runCtx, phone, auth.SendCodeOptions{})
		if err != nil {
			return err
		}

		if sentCode, ok := res.(*tg.AuthSentCode); ok {
			phoneCodeHash = sentCode.PhoneCodeHash
		} else {
			return errors.New("unexpected response from SendCode")
		}
		return nil
	})

	return phoneCodeHash, err
}

// AuthSignIn completes the stateless login flow using the phone, code, and hash.
func AuthSignIn(ctx context.Context, phone, code, hash string) error {
	sessionDir := os.Getenv("TG_SESSION_DIR")
	if sessionDir == "" {
		sessionDir = "./sessions"
	}
	storage := &session.FileStorage{Path: filepath.Join(sessionDir, fmt.Sprintf("userbot_%s.session", phone))}

	appIDStr := os.Getenv("TG_APP_ID")
	appHash := os.Getenv("TG_APP_HASH")

	if appIDStr == "" || appHash == "" {
		return errors.New("برای ورود با حساب کاربری، ابتدا باید TG_APP_ID و TG_APP_HASH را در فایل env سرور تنظیم کنید. این مقادیر را از my.telegram.org دریافت کنید.")
	}
	appID, _ := strconv.Atoi(appIDStr)

	client := telegram.NewClient(appID, appHash, telegram.Options{SessionStorage: storage})

	return client.Run(ctx, func(runCtx context.Context) error {
		_, err := client.Auth().SignIn(runCtx, phone, code, hash)
		return err
	})
}

// JoinChannel resolves the channel and joins it to receive live updates.
func (uc *UserbotClient) JoinChannel(ctx context.Context, identifier string) error {
	if uc.client == nil || uc.api == nil {
		return errors.New("userbot client is not initialized")
	}

	// Wait for the client to be ready and connected
	// For gotd, we can just issue the API call and it will multiplex if running

	if strings.HasPrefix(identifier, "https://t.me/+") {
		// Private invite link
		hash := strings.TrimPrefix(identifier, "https://t.me/+")
		_, err := uc.api.MessagesImportChatInvite(ctx, hash)
		return err
	}

	// Public username
	username := strings.TrimPrefix(identifier, "@")
	username = strings.TrimPrefix(username, "https://t.me/")

	peer, err := uc.api.ContactsResolveUsername(ctx, &tg.ContactsResolveUsernameRequest{Username: username})
	if err != nil {
		return err
	}

	if len(peer.Chats) == 0 {
		return errors.New("channel not found")
	}

	channel, ok := peer.Chats[0].(*tg.Channel)
	if !ok {
		return errors.New("resolved peer is not a channel")
	}

	_, err = uc.api.ChannelsJoinChannel(ctx, &tg.InputChannel{
		ChannelID:  channel.ID,
		AccessHash: channel.AccessHash,
	})

	if err != nil {
		if d, ok := tgerr.AsFloodWait(err); ok {
			slog.Warn("FloodWait encountered while joining channel", "duration", d, "channel", identifier)
			return fmt.Errorf("RATE_LIMIT: flood wait for %v", d)
		}
		return err
	}

	return nil
}
