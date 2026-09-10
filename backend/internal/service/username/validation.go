package username

import (
	"regexp"
	"strings"
)

var (
	// Collectible: 4-32 chars
	collectibleUsernameRegex = regexp.MustCompile(`^[a-z][a-z0-9_]{3,31}$`)
	// Standard: 5-32 chars
	standardUsernameRegex      = regexp.MustCompile(`^[a-z][a-z0-9_]{4,31}$`)
	consecutiveUnderscoreRegex = regexp.MustCompile(`__`)
)

// CanonicalizeUsername strips leading '@', whitespace and lowercases the handle.
func CanonicalizeUsername(u string) string {
	clean := strings.TrimSpace(u)
	clean = strings.TrimPrefix(clean, "@")
	return strings.ToLower(clean)
}

// ValidateUsernameFormat checks Telegram syntax rules on canonical handles.
func ValidateUsernameFormat(u string) (bool, string) {
	canonical := CanonicalizeUsername(u)
	if len(canonical) < 4 {
		return false, "Username must be at least 4 characters long"
	}
	if len(canonical) > 32 {
		return false, "Username must not exceed 32 characters"
	}
	if !collectibleUsernameRegex.MatchString(canonical) {
		return false, "Username must start with a letter and contain only lowercase letters, digits, and underscores"
	}
	if consecutiveUnderscoreRegex.MatchString(canonical) {
		return false, "Username cannot contain consecutive underscores"
	}
	if strings.HasSuffix(canonical, "_") {
		return false, "Username cannot end with an underscore"
	}
	return true, ""
}

// ValidateUsername checks if a username satisfies Telegram format rules.
func ValidateUsername(u string) bool {
	valid, _ := ValidateUsernameFormat(u)
	return valid
}

// IsCollectibleEligible returns true if the username format is valid for a Telegram Collectible (4-32 chars).
func IsCollectibleEligible(u string) bool {
	return ValidateUsername(u)
}

// IsCollectibleOnlyLength checks if the handle is strictly 4 characters (cannot be a free standard username).
func IsCollectibleOnlyLength(u string) bool {
	canonical := CanonicalizeUsername(u)
	return len(canonical) == 4 && ValidateUsername(canonical)
}

// IsBasicEligible checks if a username meets the minimum length (5-32) for a basic (free) Telegram handle.
func IsBasicEligible(u string) bool {
	canonical := CanonicalizeUsername(u)
	if !ValidateUsername(canonical) {
		return false
	}
	return len(canonical) >= 5 && standardUsernameRegex.MatchString(canonical)
}

