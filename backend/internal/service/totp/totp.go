package totp

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"math"
	"net/url"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// GenerateSecret generates a cryptographically secure 20-byte base32 TOTP secret key.
func GenerateSecret() (string, error) {
	buf := make([]byte, 20)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(buf), nil
}

// GetProvisioningURI returns the standard otpauth URI compatible with Google Authenticator, Authy, etc.
func GetProvisioningURI(secret, accountName, issuer string) string {
	encodedIssuer := url.QueryEscape(issuer)
	encodedAccount := url.QueryEscape(accountName)
	return fmt.Sprintf("otpauth://totp/%s:%s?secret=%s&issuer=%s&period=30&digits=6&algorithm=SHA1",
		encodedIssuer, encodedAccount, secret, encodedIssuer)
}

// ValidateTOTP validates a 6-digit TOTP code against a secret key with ±1 drift window.
func ValidateTOTP(code string, secret string) bool {
	valid, _ := ValidateTOTPAndGetWindow(code, secret)
	return valid
}

// ValidateTOTPAndGetWindow validates a 6-digit TOTP code and returns the matched time window step.
func ValidateTOTPAndGetWindow(code string, secret string) (bool, int64) {
	secret = strings.TrimSpace(secret)
	code = strings.TrimSpace(code)
	if secret == "" || len(code) != 6 {
		return false, 0
	}

	key, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(secret))
	if err != nil {
		key, err = base32.StdEncoding.DecodeString(strings.ToUpper(secret))
		if err != nil {
			return false, 0
		}
	}

	epochSeconds := time.Now().Unix()
	currentWindow := epochSeconds / 30

	// Allow 1 interval drift (30 seconds before and after)
	for _, offset := range []int64{0, -1, 1} {
		counter := uint64(currentWindow + offset)
		if generateCode(key, counter) == code {
			return true, int64(counter)
		}
	}
	return false, 0
}

func generateCode(key []byte, counter uint64) string {
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, counter)

	h := hmac.New(sha1.New, key)
	h.Write(buf)
	sum := h.Sum(nil)

	offset := sum[len(sum)-1] & 0x0f
	value := int64(((int(sum[offset]) & 0x7f) << 24) |
		((int(sum[offset+1]) & 0xff) << 16) |
		((int(sum[offset+2]) & 0xff) << 8) |
		(int(sum[offset+3]) & 0xff))

	mod := int32(value % int64(math.Pow10(6)))
	return fmt.Sprintf("%06d", mod)
}

// GenerateRecoveryCodes creates 10 cryptographically random, single-use recovery codes.
// Returns the plaintext codes for display and their bcrypt hashes for secure storage.
func GenerateRecoveryCodes(count int) ([]string, []string, error) {
	if count <= 0 {
		count = 10
	}
	plainCodes := make([]string, count)
	hashedCodes := make([]string, count)

	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Unambiguous chars
	for i := 0; i < count; i++ {
		bytes := make([]byte, 8)
		if _, err := rand.Read(bytes); err != nil {
			return nil, nil, err
		}
		var sb strings.Builder
		for j := 0; j < 8; j++ {
			sb.WriteByte(chars[int(bytes[j])%len(chars)])
			if j == 3 {
				sb.WriteByte('-')
			}
		}
		code := sb.String()
		plainCodes[i] = code

		hash, err := bcrypt.GenerateFromPassword([]byte(code), bcrypt.DefaultCost)
		if err != nil {
			return nil, nil, err
		}
		hashedCodes[i] = string(hash)
	}

	return plainCodes, hashedCodes, nil
}

// ValidateAndConsumeRecoveryCode checks if the provided recovery code matches any of the stored hashes.
// If valid, consumes it by returning the slice with the matched code hash removed.
func ValidateAndConsumeRecoveryCode(inputCode string, storedHashes []string) (bool, []string) {
	cleaned := strings.ToUpper(strings.TrimSpace(inputCode))
	if cleaned == "" {
		return false, storedHashes
	}

	for i, hash := range storedHashes {
		if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(cleaned)); err == nil {
			// Matched! Consume code
			newHashes := make([]string, 0, len(storedHashes)-1)
			newHashes = append(newHashes, storedHashes[:i]...)
			newHashes = append(newHashes, storedHashes[i+1:]...)
			return true, newHashes
		}
	}
	return false, storedHashes
}
