package username

import (
	"regexp"
)

var (
	// Collectible: 4-32 chars
	collectibleUsernameRegex   = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_]{3,31}$`)
	consecutiveUnderscoreRegex = regexp.MustCompile(`__`)
)

func ValidateUsername(u string) bool {
	// A valid username is either basic or collectible. Since basic is a subset of collectible length,
	// checking collectible regex is enough for structural validity.
	if !collectibleUsernameRegex.MatchString(u) {
		return false
	}
	// No consecutive underscores
	if consecutiveUnderscoreRegex.MatchString(u) {
		return false
	}
	// No trailing underscores
	if u[len(u)-1] == '_' {
		return false
	}
	return true
}

// IsBasicEligible checks if a username meets the minimum length (5) for a basic (free) username.
// Any username 4 characters long is strictly collectible.
func IsBasicEligible(u string) bool {
	if !ValidateUsername(u) {
		return false
	}
	return usernameLength(u) >= 5
}
