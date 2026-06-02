package totp

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"math"
	"strings"
	"time"
)

// ValidateTOTP validates a 6-digit TOTP code against a secret key with a window of drift allowed.
func ValidateTOTP(code string, secret string) bool {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return false
	}
	// Base32 decoding
	key, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(secret))
	if err != nil {
		// Retry with default padding
		key, err = base32.StdEncoding.DecodeString(strings.ToUpper(secret))
		if err != nil {
			return false
		}
	}

	epochSeconds := time.Now().Unix()
	// Allow 1 interval drift (30 seconds before and after)
	for _, offset := range []int64{-1, 0, 1} {
		counter := uint64((epochSeconds / 30) + offset)
		if generateCode(key, counter) == code {
			return true
		}
	}
	return false
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
