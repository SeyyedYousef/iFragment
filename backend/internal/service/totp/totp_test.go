package totp

import (
	"testing"
)

func TestTOTPGenerationAndValidation(t *testing.T) {
	secret, err := GenerateSecret()
	if err != nil {
		t.Fatalf("Failed to generate TOTP secret: %v", err)
	}
	if len(secret) < 16 {
		t.Fatalf("Generated secret is too short: %s", secret)
	}

	uri := GetProvisioningURI(secret, "test_owner", "iFragment")
	if uri == "" || len(uri) < 30 {
		t.Fatalf("Invalid provisioning URI: %s", uri)
	}

	valid, _ := ValidateTOTPAndGetWindow("000000", secret)
	// Random 000000 should almost certainly fail
	if valid {
		t.Log("000000 matched serendipitously, but format handled correctly")
	}

	// Bad input handling
	if ValidateTOTP("", secret) {
		t.Error("Empty code should not validate")
	}
	if ValidateTOTP("12345", secret) {
		t.Error("5-digit code should not validate")
	}
	if ValidateTOTP("1234567", secret) {
		t.Error("7-digit code should not validate")
	}
}

func TestRecoveryCodesGenerationAndConsumption(t *testing.T) {
	plainCodes, hashedCodes, err := GenerateRecoveryCodes(10)
	if err != nil {
		t.Fatalf("Failed to generate recovery codes: %v", err)
	}

	if len(plainCodes) != 10 || len(hashedCodes) != 10 {
		t.Fatalf("Expected 10 codes, got plain: %d, hashed: %d", len(plainCodes), len(hashedCodes))
	}

	// Validate and consume the first code
	codeToUse := plainCodes[0]
	matched, remaining := ValidateAndConsumeRecoveryCode(codeToUse, hashedCodes)
	if !matched {
		t.Fatalf("Failed to match valid recovery code: %s", codeToUse)
	}
	if len(remaining) != 9 {
		t.Fatalf("Expected 9 remaining codes after consumption, got %d", len(remaining))
	}

	// Replay attempt on consumed code MUST FAIL
	matchedAgain, _ := ValidateAndConsumeRecoveryCode(codeToUse, remaining)
	if matchedAgain {
		t.Fatalf("Replay of consumed recovery code succeeded! Must be rejected.")
	}

	// Invalid code test
	matchedInvalid, _ := ValidateAndConsumeRecoveryCode("INVALID-CODE-99", remaining)
	if matchedInvalid {
		t.Fatal("Invalid code should not match")
	}
}
