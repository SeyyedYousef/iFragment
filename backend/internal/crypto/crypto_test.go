package crypto

import (
	"testing"
)

func TestEncryptDecryptToken_RoundTrip(t *testing.T) {
	plain := "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"

	encrypted, err := EncryptToken(plain)
	if err != nil {
		t.Fatalf("EncryptToken failed: %v", err)
	}

	if len(encrypted) == 0 {
		t.Fatalf("expected non-empty encrypted bytes")
	}

	decrypted, err := DecryptToken(encrypted)
	if err != nil {
		t.Fatalf("DecryptToken failed: %v", err)
	}

	if decrypted != plain {
		t.Fatalf("expected decrypted %q, got %q", plain, decrypted)
	}
}

func TestDecryptToken_InvalidInput(t *testing.T) {
	_, err := DecryptToken([]byte("too-short"))
	if err == nil {
		t.Fatalf("expected error for invalid ciphertext")
	}
}
