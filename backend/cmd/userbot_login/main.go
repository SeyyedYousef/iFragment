package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"

	"ifragment-backend/internal/client/mtproto"

	"github.com/gotd/td/telegram/auth"
	"github.com/gotd/td/tg"
	"github.com/joho/godotenv"
)

// terminalAuth implements auth.UserAuthenticator and auth.CodeAuthenticator
// using terminal input.
type terminalAuth struct{}

func (terminalAuth) Phone(ctx context.Context) (string, error) {
	fmt.Print("Enter phone number (e.g. +1234567890): ")
	return readString()
}

func (terminalAuth) Password(ctx context.Context) (string, error) {
	fmt.Print("Enter 2FA password: ")
	return readString()
}

func (terminalAuth) AcceptTermsOfService(ctx context.Context, tos tg.HelpTermsOfService) error {
	return nil // Accept silently
}

func (terminalAuth) SignUp(ctx context.Context) (auth.UserInfo, error) {
	return auth.UserInfo{}, fmt.Errorf("signup not supported")
}

func (terminalAuth) Code(ctx context.Context, sentCode *tg.AuthSentCode) (string, error) {
	fmt.Print("Enter the code you received in Telegram: ")
	return readString()
}

func readString() (string, error) {
	reader := bufio.NewReader(os.Stdin)
	text, err := reader.ReadString('\n')
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(text), nil
}

func main() {
	// Load .env
	_ = godotenv.Load()

	if os.Getenv("TG_APP_ID") == "" || os.Getenv("TG_APP_HASH") == "" {
		fmt.Println("Error: TG_APP_ID and TG_APP_HASH must be set in .env")
		os.Exit(1)
	}

	fmt.Println("=== MTProto Userbot Login ===")
	fmt.Println("This will authenticate your personal account to act as the Userbot.")
	fmt.Println("The session will be saved in ./sessions/userbot.session")
	fmt.Println()

	ctx := context.Background()
	flow := auth.NewFlow(terminalAuth{}, auth.SendCodeOptions{})

	if err := mtproto.InteractiveLogin(ctx, flow); err != nil {
		fmt.Printf("Login failed: %v\n", err)
		os.Exit(1)
	}
}
