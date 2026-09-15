package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"fmt"
	"io"
	"log/slog"
	"os"
	"sync"
)

var (
	cryptoKey  []byte
	cryptoOnce sync.Once
)

func getCryptoKey() []byte {
	cryptoOnce.Do(func() {
		keyStr := os.Getenv("BOT_TOKEN_KEY")
		if keyStr == "" {
			jwtSecret := os.Getenv("JWT_SECRET")
			if jwtSecret != "" {
				slog.Warn("BOT_TOKEN_KEY not set. Deriving AES key from sha256(JWT_SECRET).")
				hash := sha256.Sum256([]byte(jwtSecret))
				cryptoKey = hash[:]
				return
			}
			webhookSecret := os.Getenv("WEBHOOK_SECRET_TOKEN")
			if webhookSecret != "" {
				slog.Warn("BOT_TOKEN_KEY not set. Deriving AES key from sha256(WEBHOOK_SECRET_TOKEN).")
				hash := sha256.Sum256([]byte(webhookSecret))
				cryptoKey = hash[:]
				return
			}
			if os.Getenv("APP_ENV") != "production" {
				keyStr = "dev_bot_token_key_32_characters_"
			} else {
				slog.Error("CRITICAL SECURITY VULNERABILITY: BOT_TOKEN_KEY environment variable is missing in production!")
				panic("CRITICAL SECURITY CONFIGURATION ERROR: BOT_TOKEN_KEY must be set in production")
			}
		}
		key := []byte(keyStr)
		if len(key) != 32 {
			hash := sha256.Sum256(key)
			key = hash[:]
		}
		cryptoKey = key
	})
	return cryptoKey
}

func EncryptToken(token string) ([]byte, error) {
	key := getCryptoKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	return gcm.Seal(nonce, nonce, []byte(token), nil), nil
}

func DecryptToken(ciphertext []byte) (string, error) {
	key := getCryptoKey()
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	if len(ciphertext) < gcm.NonceSize() {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonceSize := gcm.NonceSize()
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}
