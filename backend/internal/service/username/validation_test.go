package username

import "testing"

func TestValidation(t *testing.T) {
	tests := []struct {
		input             string
		canonical         string
		valid             bool
		isCollectibleOnly bool
		isBasic           bool
	}{
		{"@rare", "rare", true, true, false},
		{"@admin", "admin", true, false, true},
		{"Hello_World", "hello_world", true, false, true},
		{"abc", "abc", false, false, false},
		{"_invalid", "_invalid", false, false, false},
		{"trailing_", "trailing_", false, false, false},
		{"double__under", "double__under", false, false, false},
		{"123start", "123start", false, false, false},
		{"  @crypto  ", "crypto", true, false, true},
	}

	for _, tc := range tests {
		canon := CanonicalizeUsername(tc.input)
		if canon != tc.canonical {
			t.Errorf("CanonicalizeUsername(%q) = %q, expected %q", tc.input, canon, tc.canonical)
		}

		valid, _ := ValidateUsernameFormat(tc.input)
		if valid != tc.valid {
			t.Errorf("ValidateUsernameFormat(%q) = %v, expected %v", tc.input, valid, tc.valid)
		}

		colOnly := IsCollectibleOnlyLength(tc.input)
		if colOnly != tc.isCollectibleOnly {
			t.Errorf("IsCollectibleOnlyLength(%q) = %v, expected %v", tc.input, colOnly, tc.isCollectibleOnly)
		}

		basic := IsBasicEligible(tc.input)
		if basic != tc.isBasic {
			t.Errorf("IsBasicEligible(%q) = %v, expected %v", tc.input, basic, tc.isBasic)
		}
	}
}
