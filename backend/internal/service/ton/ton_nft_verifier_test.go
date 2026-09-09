package ton

import (
	"context"
	"testing"
)

func TestNormalizeAddress(t *testing.T) {
	addr := "  EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N  "
	normalized := NormalizeAddress(addr)
	if normalized != "EQAOQdwdw8kGftJCSFgOErM1mBjYPe4DBPq8-AhF6vr9si5N" {
		t.Fatalf("expected trimmed address, got %s", normalized)
	}
}

func TestVerifyNFTItem_InvalidAddress(t *testing.T) {
	verifier := NewTonNFTVerifier(nil)
	ctx := context.Background()

	res, err := verifier.VerifyNFTItem(ctx, "invalid-ton-addr", "anonymous_numbers")
	if err == nil {
		t.Fatalf("expected error for invalid TON address, got nil")
	}
	if res.VerificationStatus != "invalid_address" {
		t.Fatalf("expected verification status invalid_address, got %s", res.VerificationStatus)
	}
}

func TestAllowlistedCollections(t *testing.T) {
	if AllowlistedCollections["usernames"] != CanonicalUsernamesCollection {
		t.Fatalf("unexpected canonical usernames collection address")
	}
	if AllowlistedCollections["anonymous_numbers"] != CanonicalAnonymousNumbersCollection {
		t.Fatalf("unexpected canonical anonymous numbers collection address")
	}
}
